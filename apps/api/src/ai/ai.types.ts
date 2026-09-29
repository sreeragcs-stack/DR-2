export type AiRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: AiRole;
  content: string;
  /** On an `assistant` turn: the tools the model asked to run. Set by `AiService.withTools()`; you
   *  append this message unchanged before sending the results back. */
  toolCalls?: ToolCall[];
  /** On a `tool` turn: which call in the previous assistant message this answers. */
  toolCallId?: string;
}

/**
 * A tool the model may ask this app to run.
 *
 * The model never runs anything. It returns the NAME of a tool and arguments for it, your code
 * decides whether to honour that, runs it, and sends the result back. That distinction is the whole
 * safety model: a tool is a capability you have chosen to expose, not one the model has acquired.
 *
 * `parameters` is a JSON Schema object describing the arguments, e.g.
 *   { type: 'object', properties: { orderId: { type: 'string' } }, required: ['orderId'] }
 */
export interface AiTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** One request from the model to run a tool. `argumentsJson` is model output: parse it defensively
 *  and validate the result before acting on it. */
export interface ToolCall {
  id: string;
  name: string;
  argumentsJson: string;
}

/** What a tool-enabled turn produced: either an answer, or a request to run tools first. */
export type ToolTurn =
  | { kind: 'text'; text: string }
  | { kind: 'tool_calls'; calls: ToolCall[] };

/**
 * Why AI could not answer. Every value is a state the UI renders as a designed, styled panel — never
 * as an error toast and never as a stack trace.
 *
 * THIS FILE IS THE ONLY COPY OF THE CONTRACT. There used to be a second one — a Python
 * `app/gateway/errors.py` in the control plane — carrying its own reason strings, its own messages
 * and its own status mapping. It had no caller: the child app talks to the gateway directly, so the
 * control plane never sees a gateway response to classify, and nothing but its tests ever imported
 * it. The two copies had already drifted (a 401 with no "blocked" in it was `not_enabled` here and
 * `unavailable` there; a 402 was `out_of_credit` here and fell through to a retryable default
 * there). It was deleted and its verified knowledge folded into `classify()` below, which is where
 * the decision actually gets made.
 *
 * Distinctions that must stay separate, because collapsing any of them misleads somebody:
 *   ai_paused           the platform stopped this app spending. Not necessarily about money.
 *   over_daily_ceiling  this app's own daily limit. Comes back tomorrow on its own.
 *   out_of_credit       the account genuinely needs money.
 *   rate_limited        too many requests right now. Actionable by waiting seconds, not days.
 *
 * A note on WHO READS THESE. The messages are rendered inside somebody else's app, to that app's
 * own end users — not to the app's owner. So they say what is true and what the user can do, and
 * they do not narrate the owner's billing position. The owner's actionable detail (which limit,
 * how much, top up or contact support) belongs on their billing screen and in their notifications,
 * both of which already carry it.
 */
export type AiReason =
  | 'not_enabled'         // this app was never provisioned for AI
  | 'ai_paused'           // the platform paused this app's AI, for a reason not visible from here
  | 'over_daily_ceiling'  // this app hit its own daily spend limit; resets tomorrow
  | 'out_of_credit'       // the account is out of credit
  | 'rate_limited'        // too many requests from this app
  | 'provider_busy'       // upstream provider is unwell
  | 'bad_request'         // nothing usable was sent
  | 'bad_output'          // the model answered, but not in the shape the app asked for
  | 'unavailable';        // anything else, including the gateway being unreachable

export class AiUnavailable extends Error {
  constructor(public readonly reason: AiReason) {
    super(`ai unavailable: ${reason}`);
    this.name = 'AiUnavailable';
  }
}

/** What the UI needs to render a degraded state without inventing copy per call site. */
export const AI_MESSAGES: Record<AiReason, string> = {
  not_enabled: 'AI features are not enabled for this app.',
  // Deliberately does NOT say "out of credit". A key is blocked for several reasons — the owner
  // switched AI off in their settings, an operator paused a runaway app, a monthly limit was
  // reached, credit ran out — and the gateway's 401 looks identical for all of them. Naming one of
  // them would be a guess, and the guess that used to be made here told an app's users the account
  // needed money on the very turn its owner had ticked their own AI off.
  ai_paused: 'AI features are paused for this app right now.',
  over_daily_ceiling: 'This app has reached its daily AI limit. It resets tomorrow.',
  out_of_credit: 'AI is unavailable for this app right now.',
  rate_limited: 'Too many requests. Please wait a moment and try again.',
  provider_busy: 'The AI service is busy. Please try again shortly.',
  bad_request: 'That request could not be understood.',
  // Distinct from `unavailable` because the call SUCCEEDED and was paid for. Only `json()`
  // raises it: the model returned prose where the app required structured data, which a second
  // attempt often fixes and which the owner should see in the logs as a prompt problem rather
  // than as an outage.
  bad_output: 'The AI could not answer in the format this app needs. Please try again.',
  unavailable: 'AI is temporarily unavailable. Please try again in a moment.',
};

/** True when trying the same request again could plausibly succeed. */
export const AI_RETRYABLE: Record<AiReason, boolean> = {
  not_enabled: false,
  ai_paused: false,
  // False on purpose even though it does eventually clear: "retryable" drives a retry affordance in
  // the UI, and a button that cannot work again until tomorrow is not one.
  over_daily_ceiling: false,
  out_of_credit: false,
  rate_limited: true,
  provider_busy: true,
  bad_request: false,
  bad_output: true,
  unavailable: true,
};

/**
 * The HTTP status this app answers with. One map so the controller does not carry a ternary that
 * has to be kept in step with the union.
 *
 * 429 for the two "come back later" reasons, because that is the code a client library and a proxy
 * already understand as back off. 503 for everything the app cannot fix, 400 only for a request
 * that was genuinely malformed. Nothing here answers 5xx for a POLICY decision the platform made
 * deliberately — a paused app is not a broken one, and the platform's own build-time verification
 * treats a 5xx as a defect.
 */
export const AI_STATUS: Record<AiReason, number> = {
  not_enabled: 503,
  ai_paused: 503,
  over_daily_ceiling: 429,
  out_of_credit: 503,
  rate_limited: 429,
  provider_busy: 503,
  bad_request: 400,
  // 503, not 400: the caller's request was fine, the model's answer was not.
  bad_output: 503,
  unavailable: 503,
};
