/**
 * Per-caller rate limiting for this app's AI endpoints.
 *
 * WHY THE PLATFORM'S LIMITS ARE NOT ENOUGH. This app holds a virtual key with a daily budget and an
 * RPM ceiling, both enforced at the gateway. Those bound what the OWNER can lose, and they do it for
 * the app as a whole: one visitor holding down a button consumes the same pool as everybody else. If
 * the AI endpoints are reachable without signing in, and by default they are, a stranger can spend
 * the day's budget in a few minutes and every real user then sees "this app has reached its daily
 * AI limit" until tomorrow. The bill is capped; the feature is gone.
 *
 * So this is not a spend control. It is what keeps one caller from taking the whole app's share.
 *
 * WHAT IT KEYS ON, AND WHY BOTH. Two windows must pass:
 *
 *   the caller's IP     the only thing here that a caller cannot simply choose
 *   `endUserRef`        the app's own user id, when it sends one
 *
 * `endUserRef` alone would be useless: it arrives in the request body, it is not authenticated, and
 * an attacker rotates it per request. IP alone is blunt when real users share an address. Requiring
 * both means rotating the ref does not help, while a signed-in user still gets their own allowance.
 *
 * ON READING THE IP. The app sits behind the platform's proxy and Express is not configured to
 * trust it, so `req.ip` is the proxy, identical for every visitor. The proxy APPENDS the address it
 * observed to `X-Forwarded-For`, so the RIGHTMOST entry is the one it saw and the earlier entries
 * are whatever the client sent. Hence `clientIp()` below reads from the right. If a second proxy
 * hop is ever added in front, the rightmost entry becomes that hop and this needs revisiting.
 *
 * IN MEMORY, AND THAT IS THE RIGHT TRADE. Production runs a single replica, so one map is complete.
 * It is lost on redeploy, which costs an attacker one restart's worth of allowance and costs the
 * platform no infrastructure. A shared store would be the wrong shape for what this defends.
 */

/** Requests one caller may make in each window. Deliberately generous for a person, ruinous for a
 *  script: a chat user sends a handful of messages a minute, not sixty. */
const PER_MINUTE = 12;
const PER_HOUR = 120;

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;

/** Stops an attacker rotating identities from turning this map into the memory leak that takes the
 *  app down, which would be a cheaper win for them than the spend they came for. */
const MAX_TRACKED_KEYS = 20_000;

export interface ThrottleDecision {
  allowed: boolean;
  /** Seconds until the caller could succeed. Sent as `Retry-After`. */
  retryAfterSeconds: number;
}

/** The address the platform's proxy observed, or undefined if it cannot be determined. */
export function clientIp(headers: Record<string, unknown>, fallback?: string): string | undefined {
  const raw = headers['x-forwarded-for'];
  const value = Array.isArray(raw) ? raw.join(',') : typeof raw === 'string' ? raw : '';
  const hops = value.split(',').map((h) => h.trim()).filter(Boolean);
  return hops.length > 0 ? hops[hops.length - 1] : fallback;
}

export class AiThrottle {
  /** key -> request timestamps, newest last. Pruned on every read of that key. */
  private readonly hits = new Map<string, number[]>();

  /**
   * Record an attempt and say whether it is allowed. Every key given must pass; an empty list is
   * allowed, so a caller that can be identified by nothing is not accidentally blocked outright.
   */
  check(keys: (string | undefined)[], now = Date.now()): ThrottleDecision {
    const present = keys.filter((k): k is string => Boolean(k));
    let retryAfter = 0;

    for (const key of present) {
      const recent = this.record(key, now);
      const inMinute = recent.filter((t) => now - t < MINUTE_MS).length;
      const inHour = recent.length;

      if (inMinute > PER_MINUTE) {
        const oldest = recent[recent.length - inMinute];
        retryAfter = Math.max(retryAfter, Math.ceil((MINUTE_MS - (now - oldest)) / 1000));
      }
      if (inHour > PER_HOUR) {
        retryAfter = Math.max(retryAfter, Math.ceil((HOUR_MS - (now - recent[0])) / 1000));
      }
    }

    // At least a second, so a client honouring Retry-After does not spin.
    return retryAfter > 0
      ? { allowed: false, retryAfterSeconds: Math.max(1, retryAfter) }
      : { allowed: true, retryAfterSeconds: 0 };
  }

  /** Append `now` to this key's window and return it, with anything older than an hour dropped. */
  private record(key: string, now: number): number[] {
    const kept = (this.hits.get(key) ?? []).filter((t) => now - t < HOUR_MS);
    kept.push(now);
    this.hits.set(key, kept);

    if (this.hits.size > MAX_TRACKED_KEYS) this.evictStale(now);
    return kept;
  }

  /** Drop keys whose window has fully expired; if that is not enough, drop the oldest. */
  private evictStale(now: number): void {
    for (const [key, times] of this.hits) {
      if (times.length === 0 || now - times[times.length - 1] >= HOUR_MS) this.hits.delete(key);
    }
    if (this.hits.size <= MAX_TRACKED_KEYS) return;

    const byAge = [...this.hits.entries()].sort(
      (a, b) => a[1][a[1].length - 1] - b[1][b[1].length - 1],
    );
    for (const [key] of byAge.slice(0, this.hits.size - MAX_TRACKED_KEYS)) this.hits.delete(key);
  }
}
