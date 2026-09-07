import test from "node:test";
import assert from "node:assert/strict";

import { openaiToOpenAIResponsesRequest } from "../../open-sse/translator/request/openai-responses/toResponses.ts";
import { openaiToClaudeRequest } from "../../open-sse/translator/request/openai-to-claude.ts";

test("openaiToOpenAIResponsesRequest preserves parallel_tool_calls for Responses API targets (Codex, Mantle)", () => {
  const reqTrue = openaiToOpenAIResponsesRequest(
    "gpt-6-astra",
    {
      model: "gpt-6-astra",
      messages: [{ role: "user", content: "hello" }],
      parallel_tool_calls: true,
    },
    true,
    null
  ) as Record<string, unknown>;

  assert.equal(reqTrue.parallel_tool_calls, true);

  const reqFalse = openaiToOpenAIResponsesRequest(
    "gpt-6-astra",
    {
      model: "gpt-6-astra",
      messages: [{ role: "user", content: "hello" }],
      parallel_tool_calls: false,
    },
    true,
    null
  ) as Record<string, unknown>;

  assert.equal(reqFalse.parallel_tool_calls, false);
});

test("openaiToClaudeRequest maps parallel_tool_calls: false to disable_parallel_tool_use", () => {
  const reqFalse = openaiToClaudeRequest(
    "claude-opus-5",
    {
      model: "claude-opus-5",
      messages: [{ role: "user", content: "hello" }],
      parallel_tool_calls: false,
    },
    true
  ) as { tool_choice?: { type?: string; disable_parallel_tool_use?: boolean } };

  assert.ok(reqFalse.tool_choice);
  assert.equal(reqFalse.tool_choice.type, "auto");
  assert.equal(reqFalse.tool_choice.disable_parallel_tool_use, true);
});
