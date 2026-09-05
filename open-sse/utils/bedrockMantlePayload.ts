export const MANTLE_MODEL_IDS = new Set([
  "openai.gpt-5.6-sol",
  "openai.gpt-5.6-terra",
  "openai.gpt-5.6-luna",
  "openai.gpt-5.5",
  "openai.gpt-5.4",
  "openai.gpt-6-astra",
]);

export const GPT56_MODEL_IDS = new Set([
  "openai.gpt-5.6-sol",
  "openai.gpt-5.6-terra",
  "openai.gpt-5.6-luna",
  "openai.gpt-6-astra",
]);

const TOOL_RESULT_IMAGE_PLACEHOLDER = "(image omitted from tool result)";

export class MantlePayloadError extends Error {
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = "MantlePayloadError";
  }
}

type JsonRecord = Record<string, unknown>;

function cloneResponseParts(parts: unknown): unknown {
  if (!Array.isArray(parts)) return parts;
  return parts.map((part: unknown) =>
    part && typeof part === "object" ? { ...(part as JsonRecord) } : part
  );
}

function cloneResponsesInput(input: unknown): unknown {
  if (!Array.isArray(input)) return input;
  return input.map((item: unknown) => {
    if (!item || typeof item !== "object") return item;
    const rec = item as JsonRecord;
    return {
      ...rec,
      content: cloneResponseParts(rec.content),
      output: cloneResponseParts(rec.output),
    };
  });
}

function validateStoredReasoning(payload: JsonRecord): void {
  if (payload.store !== false || !Array.isArray(payload.input)) return;
  for (const [index, item] of (payload.input as unknown[]).entries()) {
    if (!item || typeof item !== "object") continue;
    const rec = item as JsonRecord;
    if (rec.type !== "reasoning") continue;
    if (typeof rec.id !== "string" || rec.id.length === 0) {
      throw new MantlePayloadError(`input[${index}] reasoning item is missing id`);
    }
    if (typeof rec.encrypted_content !== "string" || rec.encrypted_content.length === 0) {
      throw new MantlePayloadError(`input[${index}] reasoning item is missing encrypted_content`);
    }
  }
}

export function validateMantleThinkingSignatures(messages: unknown, providerName?: string): void {
  if (!Array.isArray(messages)) return;
  for (const [messageIndex, message] of (messages as unknown[]).entries()) {
    if (!message || typeof message !== "object") continue;
    const msg = message as JsonRecord;
    if (
      providerName &&
      typeof msg.provider === "string" &&
      msg.provider !== providerName &&
      msg.provider !== "amazon-bedrock-mantle" &&
      msg.provider !== "bedrock-mantle"
    ) {
      continue;
    }
    if (typeof msg.model !== "string" || !MANTLE_MODEL_IDS.has(msg.model)) continue;
    if (!Array.isArray(msg.content)) continue;
    for (const [blockIndex, block] of (msg.content as unknown[]).entries()) {
      if (!block || typeof block !== "object") continue;
      const blk = block as JsonRecord;
      if (blk.type !== "thinking") continue;
      if (typeof blk.thinkingSignature !== "string" || blk.thinkingSignature.length === 0) {
        throw new MantlePayloadError(
          `messages[${messageIndex}].content[${blockIndex}] is missing thinkingSignature`
        );
      }
      let reasoning: unknown;
      try {
        reasoning = JSON.parse(blk.thinkingSignature);
      } catch {
        throw new MantlePayloadError(
          `messages[${messageIndex}].content[${blockIndex}] has malformed thinkingSignature`
        );
      }
      if (!reasoning || typeof reasoning !== "object") {
        throw new MantlePayloadError(
          `messages[${messageIndex}].content[${blockIndex}] has a non-reasoning signature`
        );
      }
      const rRec = reasoning as JsonRecord;
      if (rRec.type !== "reasoning") {
        throw new MantlePayloadError(
          `messages[${messageIndex}].content[${blockIndex}] has a non-reasoning signature`
        );
      }
      if (typeof rRec.id !== "string" || rRec.id.length === 0) {
        throw new MantlePayloadError(
          `messages[${messageIndex}].content[${blockIndex}] reasoning signature is missing id`
        );
      }
      if (typeof rRec.encrypted_content !== "string" || rRec.encrypted_content.length === 0) {
        throw new MantlePayloadError(
          `messages[${messageIndex}].content[${blockIndex}] reasoning signature is missing encrypted_content`
        );
      }
    }
  }
}

function isInputImage(item: unknown): boolean {
  return typeof item === "object" && item !== null && (item as JsonRecord).type === "input_image";
}

function pruneHistoricalToolResultImages(payload: JsonRecord): void {
  if (!Array.isArray(payload.input)) return;
  const inputList = payload.input as unknown[];
  const lastUserIndex = inputList.findLastIndex(
    (item: unknown) =>
      typeof item === "object" && item !== null && (item as JsonRecord).role === "user"
  );
  if (lastUserIndex <= 0) return;
  for (const item of inputList.slice(0, lastUserIndex)) {
    if (!item || typeof item !== "object") continue;
    const rec = item as JsonRecord;
    if (rec.type !== "function_call_output" || !Array.isArray(rec.output)) continue;
    let replaced = false;
    rec.output = (rec.output as unknown[]).map((part: unknown) => {
      if (!isInputImage(part)) return part;
      replaced = true;
      return { type: "input_text", text: TOOL_RESULT_IMAGE_PLACEHOLDER };
    });
    if (replaced && rec.output.length === 0) {
      rec.output = [{ type: "input_text", text: TOOL_RESULT_IMAGE_PLACEHOLDER }];
    }
  }
}

function stripReasoningSummary(payload: JsonRecord): void {
  if (!payload.reasoning || typeof payload.reasoning !== "object") return;
  const rec = payload.reasoning as JsonRecord;
  if (!("summary" in rec)) return;
  const reasoning = { ...rec };
  delete reasoning.summary;
  payload.reasoning = reasoning;
}

function moveDeveloperInstruction(payload: JsonRecord): void {
  if (payload.instructions || !Array.isArray(payload.input)) return;
  const [first, ...rest] = payload.input as unknown[];
  if (!first || typeof first !== "object") return;
  const fRec = first as JsonRecord;
  if (fRec.role !== "developer" || typeof fRec.content !== "string") return;
  payload.instructions = fRec.content;
  payload.input = rest;
}

function defaultLowVerbosity(payload: JsonRecord): void {
  const text =
    payload.text && typeof payload.text === "object" ? { ...(payload.text as JsonRecord) } : {};
  if (text.verbosity === undefined) text.verbosity = "low";
  payload.text = text;
}

function normalizePromptCachePolicy(payload: JsonRecord): void {
  if (typeof payload.model === "string" && GPT56_MODEL_IDS.has(payload.model)) {
    delete payload.prompt_cache_retention;
    return;
  }
  delete payload.prompt_cache_options;
}

export function normalizeMantlePayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return payload;
  const rec = payload as JsonRecord;
  const model = typeof rec.model === "string" ? rec.model : "";
  const unqualifiedModel = model.includes("/") ? model.slice(model.indexOf("/") + 1) : model;

  if (!MANTLE_MODEL_IDS.has(model) && !MANTLE_MODEL_IDS.has(unqualifiedModel)) {
    return payload;
  }

  validateStoredReasoning(rec);
  const next: JsonRecord = { ...rec, input: cloneResponsesInput(rec.input) };
  normalizePromptCachePolicy(next);
  delete next.max_output_tokens;
  delete next.max_tokens;
  stripReasoningSummary(next);
  moveDeveloperInstruction(next);
  defaultLowVerbosity(next);
  pruneHistoricalToolResultImages(next);
  return next;
}
