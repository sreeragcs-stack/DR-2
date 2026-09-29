import { Body, Controller, Get, HttpException, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AiService, type Capability } from './ai.service';
import { AiThrottle, clientIp } from './ai.throttle';
import {
  AI_MESSAGES,
  AI_RETRYABLE,
  AI_STATUS,
  AiUnavailable,
  type ChatMessage,
} from './ai.types';

/**
 * The app's own AI endpoints. Mounted under /api/ai/* by the platform's route convention.
 *
 * THIS APP NEVER HOLDS A PROVIDER KEY. It holds a virtual key scoped to this app alone, with its own
 * daily ceiling, injected as AI_GATEWAY_KEY. The key lives only in this backend's environment — never
 * in the web bundle, where it would be baked into a static asset and served to every visitor.
 *
 * Add your own auth guard here if the feature should not be public. The platform bounds SPEND; it
 * does not know who is allowed to use your app.
 */
@Controller('ai')
export class AiController {
  /**
   * One per app instance. The gateway caps what this app can SPEND in a day; this caps what one
   * caller can take of it, which is a different failure and the one an open endpoint invites.
   */
  private readonly throttle = new AiThrottle();

  constructor(private readonly ai: AiService) {}

  /**
   * Refuse a caller who is taking more than their share, before any money is spent.
   *
   * Answers with the existing `rate_limited` state, so the UI already knows how to render it and
   * already shows a retry affordance. Adds `Retry-After`, which clients and proxies understand.
   */
  private enforceThrottle(req: Request, endUserRef: string | undefined, res?: Response): void {
    const decision = this.throttle.check([clientIp(req?.headers ?? {}, req?.ip), endUserRef]);
    if (decision.allowed) return;
    res?.setHeader('Retry-After', String(decision.retryAfterSeconds));
    throw new HttpException(
      {
        error: 'ai_unavailable',
        reason: 'rate_limited',
        message: AI_MESSAGES.rate_limited,
        retryable: AI_RETRYABLE.rate_limited,
        retryAfterSeconds: decision.retryAfterSeconds,
      },
      AI_STATUS.rate_limited,
    );
  }

  /**
   * Lets the UI decide what to render BEFORE the user types anything, without spending money.
   * The pack deliberately never fires a model call on mount: a page that does turns a build-time
   * verification pass into paid calls, and a page refresh into a bill.
   */
  @Get('status')
  status() {
    return { enabled: this.ai.enabled };
  }

  @Post('chat')
  async chat(
    @Req() req: Request,
    @Body()
    body: {
      messages?: ChatMessage[];
      capability?: Capability;
      endUserRef?: string;
    },
  ) {
    this.enforceThrottle(req, body?.endUserRef);
    try {
      const reply = await this.ai.chat(body?.messages ?? [], {
        capability: body?.capability,
        endUserRef: body?.endUserRef,
      });
      return { reply };
    } catch (err) {
      if (err instanceof AiUnavailable) {
        // A structured, renderable state — not a 500. The distinction matters beyond politeness:
        // the platform's build-time verification loads this page in a browser and treats console
        // errors and 5xx as defects, so a policy decision surfacing as a crash would make the
        // build itself fail.
        throw new HttpException(
          {
            error: 'ai_unavailable',
            reason: err.reason,
            message: AI_MESSAGES[err.reason],
            retryable: AI_RETRYABLE[err.reason],
          },
          // From the one map in ai.types.ts rather than a ternary here. The status used to be 503
          // for everything except a malformed body, which answered a deliberate policy decision —
          // a paused app, a spent daily limit — with "this server is broken".
          AI_STATUS[err.reason],
        );
      }
      throw err;
    }
  }

  /**
   * The streaming variant. Writes text deltas as Server-Sent Events.
   *
   * Prefer this in a chat UI: a buffered answer arriving all at once after several seconds reads as a
   * broken app rather than a design choice.
   *
   * Uses @Res() and writes the response by hand because the FAILURE mode needs care. Once a single
   * byte has been flushed the status line is already sent, so a mid-stream failure cannot become a
   * 503 — it has to arrive as an in-band event the client checks for. Sending the reason before any
   * delta is why the client can still render a proper panel for a failure that happens immediately.
   */
  @Post('chat/stream')
  async chatStream(
    @Req() req: Request,
    @Body()
    body: {
      messages?: ChatMessage[];
      capability?: Capability;
      endUserRef?: string;
    },
    @Res() res: Response,
  ): Promise<void> {
    // Before a single byte of the stream: once headers are written the only way to report anything
    // is an in-band event, and a refusal deserves a real status code.
    this.enforceThrottle(req, body?.endUserRef, res);

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    let started = false;
    try {
      const stream = this.ai.stream(body?.messages ?? [], {
        capability: body?.capability,
        endUserRef: body?.endUserRef,
      });

      for await (const delta of stream) {
        if (!started) {
          // Headers are written on the FIRST delta, not before the call: if the gateway refuses
          // immediately we still want to answer with a normal JSON error and a real status code.
          res.status(200);
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache, no-transform');
          res.setHeader('Connection', 'keep-alive');
          // Defeats proxy buffering, which otherwise re-buffers the stream and undoes the point of
          // streaming at all.
          res.setHeader('X-Accel-Buffering', 'no');
          res.flushHeaders?.();
          started = true;
        }
        send('delta', { text: delta });
      }

      if (!started) {
        // A stream that produced nothing at all. Report it as a failure rather than an empty success,
        // or the UI shows a blank bubble and the user assumes the app is broken.
        throw new AiUnavailable('unavailable');
      }
      send('done', {});
      res.end();
    } catch (err) {
      const reason = err instanceof AiUnavailable ? err.reason : 'unavailable';
      const payload = {
        error: 'ai_unavailable',
        reason,
        message: AI_MESSAGES[reason],
        retryable: AI_RETRYABLE[reason],
      };
      if (!started) {
        // Nothing sent yet: a normal HTTP error, same shape and same status map as POST /ai/chat.
        res.status(AI_STATUS[reason]).json(payload);
        return;
      }
      // Already streaming: the status line is long gone, so the only honest option is an in-band
      // error event. A client that ignores it sees a truncated answer, which is why the UI should
      // treat 'error' as terminal.
      send('error', payload);
      res.end();
    }
  }
}
