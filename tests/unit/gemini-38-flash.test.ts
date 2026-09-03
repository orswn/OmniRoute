import test from "node:test";
import assert from "node:assert/strict";

import {
  ANTIGRAVITY_PUBLIC_MODELS,
  ANTIGRAVITY_MODEL_ALIASES,
} from "../../open-sse/config/antigravityModelAliases.ts";
import { AGY_PUBLIC_MODELS } from "../../open-sse/config/agyModels.ts";
import { MODEL_SPECS } from "../../src/shared/constants/modelSpecs.ts";
import { geminiProvider } from "../../open-sse/config/providers/registry/gemini/index.ts";

test("Gemini 3.8 Flash models registered across Antigravity and Gemini catalogs", () => {
  const agyIds = AGY_PUBLIC_MODELS.map((m) => m.id);
  assert.ok(agyIds.includes("gemini-3.8-flash-high"));
  assert.ok(agyIds.includes("gemini-3.8-flash-medium"));
  assert.ok(agyIds.includes("gemini-3.8-flash-low"));
  assert.ok(agyIds.includes("gemini-3.8-flash-tiered"));

  const antigravityIds = ANTIGRAVITY_PUBLIC_MODELS.map((m) => m.id);
  assert.ok(antigravityIds.includes("gemini-3.8-flash-high"));
  assert.ok(antigravityIds.includes("gemini-3.8-flash-medium"));
  assert.ok(antigravityIds.includes("gemini-3.8-flash-low"));
  assert.ok(antigravityIds.includes("gemini-3.8-flash-tiered"));

  assert.equal(ANTIGRAVITY_MODEL_ALIASES["gemini-3.8-flash"], "gemini-3.8-flash-tiered");
  assert.equal(ANTIGRAVITY_MODEL_ALIASES["gemini-3.8-flash-high"], "gemini-3.8-flash-tiered");
  assert.equal(ANTIGRAVITY_MODEL_ALIASES["gemini-3.8-flash-medium"], "gemini-3.8-flash-tiered");
  assert.equal(ANTIGRAVITY_MODEL_ALIASES["gemini-3.8-flash-low"], "gemini-3.8-flash-tiered");

  const geminiIds = geminiProvider.models.map((m) => m.id);
  assert.ok(geminiIds.includes("gemini-3.8-flash"));

  const specHigh = MODEL_SPECS["gemini-3.8-flash-high"];
  assert.ok(specHigh);
  assert.equal(specHigh.supportsThinking, true);
  assert.equal(specHigh.defaultThinkingBudget, 24576);
  assert.equal(specHigh.contextWindow, 1048576);

  const specMed = MODEL_SPECS["gemini-3.8-flash-medium"];
  assert.ok(specMed);
  assert.equal(specMed.defaultThinkingBudget, 8192);

  const specLow = MODEL_SPECS["gemini-3.8-flash-low"];
  assert.ok(specLow);
  assert.equal(specLow.defaultThinkingBudget, 1024);
});
