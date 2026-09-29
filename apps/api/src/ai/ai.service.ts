import { Injectable, Logger } from '@nestjs/common';
import {
  AiUnavailable,
  type AiReason,
  type AiTool,
  type ChatMessage,
  type ToolTurn,
} from './ai.types';

// Capability aliases, never real model names. The platform resolves these at the gateway, which is
// what lets a model be retired without touching this app — and what stops a prompt injected through
// user content from naming an expensive model. Asking for a literal id (e.g. 'gpt-4o') is rejected
// by the gateway, so there is no point adding one here.
export type Capability = 'fast' | 'smart';

/**
 * Request-shape limits, set by the platform and enforced here.
 *
 * These used to be three `const`s, which made them unchangeable in practice: the pack is copied
 * into this repository at build time, so raising a limit for new apps did nothing for one already
 * published, and the old 1024-token output ceiling silently truncated every "generate a document"
 * feature at roughly 700 words.
 *
 * They now arrive as environment variables, resolved per project from the platform settings and any
 * per-app override (see the platform's `app/ai_limits.py`). The defaults below are what applies if
 * the variables are absent, and they deliberately MATCH the platform's own defaults -- if the two
 * drifted, an app would behave differently depending on whether it had been re-provisioned since
 * the last change, which is exactly the kind of difference nobody thinks to look for.
 *
 * Still enforced HERE rather than trusted from the caller: the caller is application code that a
 * prompt can influence, and a request for 100k output tokens is a request to spend real money.
 */
function envInt(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  // Number('') is 0 and Number(undefined) is NaN, so both an unset and an empty variable fall back
  // rather than pinning the limit to zero and making every call fail.
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

const MAX_OUTPUT_TOKENS = envInt('AI_MAX_OUTPUT_TOKENS', 8192);
const MAX_CHARS = envInt('AI_MAX_INPUT_CHARS', 48_000);
// 0 means do not cap the number of turns, and it is the default. Capping turns truncated a
// conversation from its FRONT, throwing away the context the user established first; the character
// budget above is what actually bounds the request. `envInt` rejects 0 as a limit, so this reads
// the variable directly.
const MAX_MESSAGES = (() => {
  const raw = Number(process.env.AI_MAX_MESSAGES);
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 0;
})();
// Whether this app may use tool calling. Platform-wide switch; an app still has to pass tools.
const TOOLS_ENABLED = (process.env.AI_TOOLS_ENABLED ?? 'true') !== 'false';

const CAPABILITIES: readonly Capability[] = ['fast', 'smart'];

/**
 * Force an arbitrary value onto one of the two aliases.
 *
 * NECESSARY EVEN THOUGH `capability` IS TYPED. It arrives in a public HTTP body and TypeScript
 * types are erased at runtime, so `{"capability": "openai/gpt-5.4-opus"}` was previously copied
 * straight into the gateway's `model` field. Containment was entirely structural — the gateway only
 * ever learns deployments whose model_name is an alias, so a literal model id matches nothing and
 * LiteLLM refuses it — but relying on that meant an opaque upstream 400 for what is really a
 * malformed request, and the platform's own build prompt tells the agent that "anything else is
 * rejected", implying the check lives here. Now it does.
 */
function capabilityOf(value: unknown): Capability {
  return CAPABILITIES.includes(value as Capability) ? (value as Capability) : 'fast';
}

/**
 * Unwrap ```json ... ``` if the model added one anyway.
 *
 * Told not to use a code fence, most models comply and some do not, and the ones that do not are
 * otherwise returning perfectly good JSON. Refusing that answer would fail a request over
 * punctuation.
 */
/**
 * One message in the shape the gateway expects.
 *
 * The pack's own `ChatMessage` keeps tool fields flat and camelCase because that is pleasanter to
 * write in an app; the wire wants OpenAI's nesting. Converting in one place means app code never
 * has to know the difference, and a tool result never reaches the gateway with the wrong key --
 * which fails as a confusing 400 rather than as anything that names the real problem.
 */
function toWire(m: ChatMessage): Record<string, unknown> {
  if (m.role === 'tool') {
    return { role: 'tool', tool_call_id: m.toolCallId ?? '', content: m.content ?? '' };
  }
  if (m.toolCalls?.length) {
    return {
      role: 'assistant',
      // Null rather than '': an assistant turn that only requested tools has no text, and some
      // providers reject an empty string where they accept an absent one.
      content: m.content || null,
      tool_calls: m.toolCalls.map((c) => ({
        id: c.id,
        type: 'function',
        function: { name: c.name, arguments: c.argumentsJson },
      })),
    };
  }
  return { role: m.role, content: m.content };
}

function stripFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) return trimmed;
  return trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

@Injectable()
export class AiService {
  private readonly log = new Logger('AiService');
  private readonly baseUrl = process.env.AI_GATEWAY_URL ?? '';
  private readonly apiKey = process.env.AI_GATEWAY_KEY ?? '';

  /** False when this app was never provisioned for AI. Callers should render an absent state, not an error. */
  get enabled(): boolean {
    return Boolean(this.baseUrl && this.apiKey);
  }

  /**
   * One completion. Throws AiUnavailable with a machine-readable reason on every failure path, so
   * the controller can turn it into a clean, styled state rather than a 500.
   *
   * `endUserRef` is an opaque id for one of THIS app's users, used only for cost attribution on the
   * owner's usage panel. It is not authenticated and must never be treated as identity.
   */
  async chat(
    messages: ChatMessage[],
    opts: {
      capability?: Capability;
      endUserRef?: string;
      maxTokens?: number;
      /** Ask the provider to emit syntactically valid JSON. Set by `json()`; see it for the
       *  provider-support caveat and the fallback. */
      responseFormat?: 'json_object';
    } = {},
  ): Promise<string> {
    if (!this.enabled) throw new AiUnavailable('not_enabled');

    const trimmed = this.sanitise(messages);
    if (trimmed.length === 0) throw new AiUnavailable('bad_request');

    const body = {
      model: capabilityOf(opts.capability),
      messages: trimmed,
      max_tokens: Math.min(opts.maxTokens ?? MAX_OUTPUT_TOKENS, MAX_OUTPUT_TOKENS),
      // Attributes the call to one of this app's own users on the owner's usage panel.
      ...(opts.endUserRef ? { user: opts.endUserRef } : {}),
      ...(opts.responseFormat ? { response_format: { type: opts.responseFormat } } : {}),
    };

    let response = await this.post(body);

    // Not every model behind an alias accepts `response_format`, and the ones that do not answer
    // 400 rather than ignoring it. Dropping it and retrying is the right move: `json()` also states
    // the requirement in the prompt, so the second attempt still usually returns JSON, and the
    // alternative is a feature that works or not depending on which model the alias points at
    // today. Only the JSON path can reach this, so an ordinary chat pays nothing for it.
    if (response.status === 400 && opts.responseFormat) {
      this.log.warn('model rejected response_format; retrying without it');
      const { response_format: _dropped, ...plain } = body;
      response = await this.post(plain);
    }

    if (!response.ok) {
      throw new AiUnavailable(await this.classify(response));
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new AiUnavailable('unavailable');
    return text;
  }

  /**
   * One turn that may call tools.
   *
   * The model does NOT run anything. It answers with either text or a request to run one or more of
   * the tools you offered, and your code decides what to honour. That is the entire safety model,
   * and it is why this returns a discriminated union instead of quietly executing something:
   *
   *   const turn = await this.ai.withTools(messages, [findOrder]);
   *   if (turn.kind === 'tool_calls') {
   *     for (const call of turn.calls) {
   *       const args = JSON.parse(call.argumentsJson);          // model output: validate it
   *       const result = await this.runMyTool(call.name, args); // YOUR code, YOUR authorisation
   *       messages.push({ role: 'assistant', content: '', toolCalls: turn.calls });
   *       messages.push({ role: 'tool', toolCallId: call.id, content: JSON.stringify(result) });
   *     }
   *     const answer = await this.ai.withTools(messages, [findOrder]);  // now it can answer
   *   }
   *
   * Three rules worth keeping in front of you while writing the loop:
   *
   * - **Check authorisation inside the tool, against the signed-in user.** The model asked for
   *   order 5; it has no idea whose order that is, and neither does the argument. A tool that
   *   trusts its arguments is an authorisation bypass with a chat interface in front of it.
   * - **Bound the loop.** Two or three rounds, then answer with what you have. A model that keeps
   *   asking for tools spends money on every round.
   * - **Do not expose a tool that writes something irreversible** without a human confirming it.
   *
   * Throws AiUnavailable('bad_request') when tools are switched off platform-wide, so a UI built
   * for them renders its designed unavailable state rather than silently degrading to plain chat.
   */
  async withTools(
    messages: ChatMessage[],
    tools: AiTool[],
    opts: { capability?: Capability; endUserRef?: string; maxTokens?: number } = {},
  ): Promise<ToolTurn> {
    if (!this.enabled) throw new AiUnavailable('not_enabled');
    if (!TOOLS_ENABLED) throw new AiUnavailable('bad_request');

    const trimmed = this.sanitise(messages);
    if (trimmed.length === 0 || tools.length === 0) throw new AiUnavailable('bad_request');

    const response = await this.post({
      model: capabilityOf(opts.capability),
      messages: trimmed.map(toWire),
      max_tokens: Math.min(opts.maxTokens ?? MAX_OUTPUT_TOKENS, MAX_OUTPUT_TOKENS),
      ...(opts.endUserRef ? { user: opts.endUserRef } : {}),
      tools: tools.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      })),
      tool_choice: 'auto',
    });
    if (!response.ok) throw new AiUnavailable(await this.classify(response));

    const data = (await response.json()) as {
      choices?: {
        message?: {
          content?: string | null;
          tool_calls?: { id?: string; function?: { name?: string; arguments?: string } }[];
        };
      }[];
    };
    const message = data.choices?.[0]?.message;
    const calls = (message?.tool_calls ?? [])
      .filter((c) => c.function?.name)
      .map((c) => ({
        id: c.id ?? '',
        name: c.function?.name ?? '',
        argumentsJson: c.function?.arguments ?? '{}',
      }));

    if (calls.length > 0) return { kind: 'tool_calls', calls };
    const text = message?.content?.trim();
    if (!text) throw new AiUnavailable('unavailable');
    return { kind: 'text', text };
  }

  /** One POST to the gateway, with network-level failure turned into a renderable reason. */
  private async post(body: unknown): Promise<Response> {
    try {
      return await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });
    } catch {
      // Network-level: timeout, DNS, refused. Retryable, and never a stack trace to the user.
      throw new AiUnavailable('unavailable');
    }
  }

  /**
   * A completion parsed into an object, for the features that need DATA rather than prose:
   * classification, tagging, field extraction, scoring, routing.
   *
   * WHY THIS EXISTS. Without it, every such feature is written the same way: ask the model in
   * English for "just the category name", then pick the answer back out of whatever it wrote. That
   * works in a demo and drifts in production, because the failure is not an error. The model
   * answers "Category: Billing (though it could arguably be Support)", the regex takes the first
   * word, and the ticket is filed under nothing anyone will notice for a month.
   *
   * `shape` is a plain-English description of the object wanted, e.g.
   * `'{ "category": one of "billing" | "support" | "sales", "confidence": number 0-1 }'`. It is
   * appended as a system message, so the same text drives both the prompt and the expectation.
   *
   * `validate` is optional and is the difference between valid JSON and USABLE data. Parsing only
   * proves the model emitted an object; it does not prove the object has the fields the caller is
   * about to read, and `undefined` flowing into a database column is the same silent failure in a
   * new place. Pass a guard for anything whose fields matter.
   *
   * Throws AiUnavailable('bad_output') when the answer cannot be parsed or fails `validate` -- a
   * reason distinct from `unavailable` because the call succeeded and was paid for.
   */
  async json<T = unknown>(
    messages: ChatMessage[],
    shape: string,
    opts: {
      capability?: Capability;
      endUserRef?: string;
      maxTokens?: number;
      validate?: (value: unknown) => value is T;
    } = {},
  ): Promise<T> {
    const instruction: ChatMessage = {
      role: 'system',
      content:
        `Answer with a single JSON object and nothing else. No prose, no explanation, no code ` +
        `fence. The object must match this shape:\n${shape}`,
    };

    const reply = await this.chat([instruction, ...messages], {
      capability: opts.capability,
      endUserRef: opts.endUserRef,
      maxTokens: opts.maxTokens,
      responseFormat: 'json_object',
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripFence(reply));
    } catch {
      // Truncated by MAX_OUTPUT_TOKENS is the likeliest cause after a model that ignores the
      // instruction, and both look identical here. Logged at warn so the owner can see which.
      this.log.warn(`json(): reply was not parseable JSON: ${reply.slice(0, 200)}`);
      throw new AiUnavailable('bad_output');
    }

    if (opts.validate && !opts.validate(parsed)) {
      this.log.warn(`json(): reply parsed but failed validation: ${reply.slice(0, 200)}`);
      throw new AiUnavailable('bad_output');
    }
    return parsed as T;
  }

  /**
   * The same call, streamed token by token.
   *
   * Why this exists rather than only `chat()`: a buffered answer that appears all at once after
   * several seconds reads as a broken or very slow app, not as a design choice. And because a
   * published app keeps the pack version it shipped with, an app generated against a non-streaming
   * endpoint would likely stay that way — so streaming is cheaper to have from the start than to
   * retrofit.
   *
   * Yields plain text deltas. The caller writes them to an SSE response; this method deliberately
   * knows nothing about HTTP framing so it can also be used server-side.
   */
  async *stream(
    messages: ChatMessage[],
    opts: { capability?: Capability; endUserRef?: string; maxTokens?: number } = {},
  ): AsyncGenerator<string> {
    if (!this.enabled) throw new AiUnavailable('not_enabled');

    const trimmed = this.sanitise(messages);
    if (trimmed.length === 0) throw new AiUnavailable('bad_request');

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: capabilityOf(opts.capability),
          messages: trimmed,
          max_tokens: Math.min(opts.maxTokens ?? MAX_OUTPUT_TOKENS, MAX_OUTPUT_TOKENS),
          stream: true,
          ...(opts.endUserRef ? { user: opts.endUserRef } : {}),
        }),
        signal: AbortSignal.timeout(120_000),
      });
    } catch {
      throw new AiUnavailable('unavailable');
    }

    // Classify BEFORE reading the body as a stream: an error response is ordinary JSON, and a
    // failure must reach the UI as a renderable reason rather than as a broken stream.
    if (!response.ok) throw new AiUnavailable(await this.classify(response));
    if (!response.body) throw new AiUnavailable('unavailable');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE frames are separated by a blank line. Keep the trailing partial in the buffer — a chunk
      // boundary lands mid-frame often enough that parsing per-chunk drops tokens.
      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';

      for (const frame of frames) {
        for (const line of frame.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const delta = JSON.parse(payload) as {
              choices?: { delta?: { content?: string } }[];
            };
            const piece = delta.choices?.[0]?.delta?.content;
            if (piece) yield piece;
          } catch {
            // A malformed frame is not worth failing a half-delivered answer over.
          }
        }
      }
    }
  }

  /**
   * Map a gateway failure onto a reason the UI can render distinctly.
   *
   * THE ONE IMPLEMENTATION OF THIS CONTRACT — see the header of ai.types.ts for the Python copy
   * that used to exist beside it, why it could never run, and how the two had already drifted.
   * Statuses below were read off a running litellm v1.94.0, not guessed; one of them contradicts
   * the original design note, which said a blocked key answers 403. It answers 401.
   *
   * Status alone is never enough, and this is the piece worth reading twice: 401 covers a blocked
   * key AND a missing one, and 429 covers both this app's own daily ceiling and the upstream
   * provider throttling the platform. Collapsing either pair misleads somebody about what to do.
   */
  private async classify(response: Response): Promise<AiReason> {
    let body = '';
    try {
      body = (await response.text()).toLowerCase();
    } catch {
      /* body is optional for classification */
    }
    const budget =
      body.includes('budget') || body.includes('exceeded spend') || body.includes('max_budget');

    if (response.status === 401) {
      // A BLOCKED KEY IS NOT A BILLING STATEMENT. The control plane blocks a key for four different
      // reasons — the owner switched AI off in their own settings, an operator paused the app,
      // the account's monthly limit was reached, credit ran out — and LiteLLM's 401 is
      // byte-identical for all of them ("Authentication Error, Key is blocked. Update via
      // /key/unblock"). Nothing in this response says which.
      //
      // This used to return 'out_of_credit', so an owner who ticked their own "AI features enabled"
      // box off had their app tell its users the account needed more credit — a false billing claim
      // that people act on by paying, produced by a switch the owner had just flipped themselves,
      // and flatly contradicting the settings screen that promised the panel would read
      // "unavailable". 'ai_paused' is the honest answer to a question this response cannot settle.
      return body.includes('blocked') ? 'ai_paused' : 'not_enabled';
    }
    if (response.status === 402) return 'out_of_credit';
    // 429 BEFORE the bare `budget` check: LiteLLM returns 429 both for our daily ceiling and for
    // the provider throttling us, and only the body tells them apart. Testing `budget` first made
    // this branch unreachable — a provider throttle and a spent daily budget are different things
    // to tell a user, and one of them is worth retrying in a few seconds.
    if (response.status === 429) return budget ? 'over_daily_ceiling' : 'rate_limited';
    // The daily ceiling can also surface as a plain 400 or a 403 depending on where LiteLLM catches
    // it. Still the ceiling, still resets tomorrow — and specifically NOT 'out_of_credit', which
    // would send the owner to top up an account that has plenty.
    if (budget) return 'over_daily_ceiling';
    if (response.status >= 500) return 'provider_busy';

    this.log.warn(`unexpected gateway status ${response.status}`);
    return 'unavailable';
  }

  /** Bound what leaves this process: total size, roles, and the turn count if one is configured. */
  private sanitise(messages: ChatMessage[]): ChatMessage[] {
    const usable = messages
      .filter((m) => Boolean(m))
      // Empty content is normally nothing to send, with two exceptions that are structural rather
      // than accidental: an assistant turn that ONLY requested tools carries no text, and a tool
      // result may legitimately be an empty string. Dropping either breaks the call/result pairing
      // and the provider rejects the whole request.
      .filter(
        (m) =>
          (typeof m.content === 'string' && m.content.trim().length > 0) ||
          Boolean(m.toolCalls?.length) ||
          m.role === 'tool',
      )
      .filter(
        (m) =>
          m.role === 'user' ||
          m.role === 'assistant' ||
          m.role === 'system' ||
          m.role === 'tool',
      );
    // MAX_MESSAGES of 0 means no turn limit, which is the default: a conversation is bounded by
    // MAX_CHARS below, and that trims from the oldest end for the same total budget without
    // discarding a short exchange just because it had many turns.
    const kept = MAX_MESSAGES > 0 ? usable.slice(-MAX_MESSAGES) : usable;

    let total = 0;
    const out: ChatMessage[] = [];
    // Newest-first so a long conversation keeps its most recent turns rather than its oldest.
    for (const m of kept.reverse()) {
      total += m.content.length;
      if (total > MAX_CHARS) break;
      out.unshift(m);
    }
    return out;
  }
}
