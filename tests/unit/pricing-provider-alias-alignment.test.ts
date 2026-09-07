import test from "node:test";
import assert from "node:assert/strict";

import { PROVIDER_ID_TO_ALIAS } from "../../open-sse/config/providerModels.ts";
import { getPricingForModel, getDefaultPricing } from "../../src/shared/constants/pricing.ts";

test("Every provider in PROVIDER_ID_TO_ALIAS with pricing resolves identically via canonical ID and alias", () => {
  const table = getDefaultPricing() as Record<string, Record<string, unknown>>;

  for (const [canonicalId, alias] of Object.entries(PROVIDER_ID_TO_ALIAS)) {
    const hasCanonical = Boolean(table[canonicalId]);
    const hasAlias = Boolean(table[alias]);

    if (!hasCanonical && !hasAlias) {
      continue;
    }

    assert.ok(
      hasCanonical,
      `Provider "${canonicalId}" missing in DEFAULT_PRICING table (only alias "${alias}" exists)`
    );
    assert.ok(
      hasAlias,
      `Alias "${alias}" missing in DEFAULT_PRICING table (only canonical "${canonicalId}" exists)`
    );

    const canonicalModels = Object.keys(table[canonicalId] || {});
    const aliasModels = Object.keys(table[alias] || {});
    assert.ok(canonicalModels.length > 0, `Provider "${canonicalId}" has empty pricing`);
    assert.deepEqual(
      canonicalModels.sort(),
      aliasModels.sort(),
      `Model keys differ between canonical "${canonicalId}" and alias "${alias}"`
    );

    // Verify getPricingForModel returns the exact same object for the first model
    const testModel = canonicalModels[0];
    const canonicalPricing = getPricingForModel(canonicalId, testModel);
    const aliasPricing = getPricingForModel(alias, testModel);
    assert.ok(
      canonicalPricing,
      `getPricingForModel("${canonicalId}", "${testModel}") returned null`
    );
    assert.ok(aliasPricing, `getPricingForModel("${alias}", "${testModel}") returned null`);
    assert.deepEqual(canonicalPricing, aliasPricing);
  }
});

test("Canonical providers codex and claude resolve model pricing", () => {
  const codexAstra = getPricingForModel("codex", "gpt-6-astra");
  assert.ok(codexAstra, "codex/gpt-6-astra must return pricing");
  assert.equal(codexAstra.input, 10.0);
  assert.equal(codexAstra.output, 50.0);

  const claudeOpus = getPricingForModel("claude", "claude-opus-5");
  assert.ok(claudeOpus, "claude/claude-opus-5 must return pricing");
  assert.equal(claudeOpus.input, 5.0);
  assert.equal(claudeOpus.output, 25.0);
});
