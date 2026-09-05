import test from "node:test";
import assert from "node:assert/strict";

import { getPricingForModel } from "../../src/shared/constants/pricing.ts";
import { computeCostFromPricing, calculateCost } from "../../src/lib/usage/costCalculator.ts";

test.after(async () => {
  const { resetDbInstance } = await import("../../src/lib/db/core.ts");
  resetDbInstance();
});

test("Bedrock Mantle pricing is registered for mantle and bedrock-mantle", () => {
  for (const provider of ["bedrock-mantle", "mantle"]) {
    const solPricing = getPricingForModel(provider, "openai.gpt-5.6-sol");
    assert.ok(solPricing, `missing sol pricing for ${provider}`);
    assert.equal(solPricing.input, 4.4);
    assert.equal(solPricing.output, 22.0);
    assert.equal(solPricing.cached, 0.44);
    assert.equal(solPricing.cache_creation, 5.5);
    assert.ok(solPricing.long_context, "missing long_context for sol");
    const longContext = solPricing.long_context as Record<string, number>;
    assert.equal(longContext.threshold, 272000);
    assert.equal(longContext.input, 8.8);
    assert.equal(longContext.output, 33.0);
    assert.equal(longContext.cached, 0.88);
    assert.equal(longContext.cache_creation, 11.0);

    const terraPricing = getPricingForModel(provider, "openai.gpt-5.6-terra");
    assert.ok(terraPricing, `missing terra pricing for ${provider}`);
    assert.equal(terraPricing.input, 2.2);
    assert.equal(terraPricing.output, 13.2);
    assert.equal(terraPricing.cached, 0.22);
    assert.equal(terraPricing.cache_creation, 2.75);

    const lunaPricing = getPricingForModel(provider, "openai.gpt-5.6-luna");
    assert.ok(lunaPricing, `missing luna pricing for ${provider}`);
    assert.equal(lunaPricing.input, 0.22);
    assert.equal(lunaPricing.output, 1.32);
    assert.equal(lunaPricing.cached, 0.022);
    assert.equal(lunaPricing.cache_creation, 0.275);

    const gpt55Pricing = getPricingForModel(provider, "openai.gpt-5.5");
    assert.ok(gpt55Pricing, `missing gpt-5.5 pricing for ${provider}`);
    assert.equal(gpt55Pricing.input, 5.5);
    assert.equal(gpt55Pricing.output, 33.0);
    assert.equal(gpt55Pricing.cached, 0.55);

    const gpt54Pricing = getPricingForModel(provider, "openai.gpt-5.4");
    assert.ok(gpt54Pricing, `missing gpt-5.4 pricing for ${provider}`);
    assert.equal(gpt54Pricing.input, 2.75);
    assert.equal(gpt54Pricing.output, 16.5);
    assert.equal(gpt54Pricing.cached, 0.275);
  }
});

test("computeCostFromPricing uses short-context rates when input <= 272K", () => {
  const solPricing = getPricingForModel("bedrock-mantle", "openai.gpt-5.6-sol");
  assert.ok(solPricing);

  // 100,000 prompt tokens (<= 272K), 1,000 completion tokens
  // input: 100,000 * 4.40 / 1M = 0.44
  // output: 1,000 * 22.00 / 1M = 0.022
  // total: 0.462
  const cost = computeCostFromPricing(solPricing, {
    prompt_tokens: 100000,
    completion_tokens: 1000,
  });
  assert.equal(Math.round(cost * 1e6) / 1e6, 0.462);
});

test("computeCostFromPricing uses long-context rates when input > 272K", () => {
  const solPricing = getPricingForModel("bedrock-mantle", "openai.gpt-5.6-sol");
  assert.ok(solPricing);

  // 300,000 prompt tokens (> 272K), 1,000 completion tokens
  // input: 300,000 * 8.80 / 1M = 2.64
  // output: 1,000 * 33.00 / 1M = 0.033
  // total: 2.673
  const cost = computeCostFromPricing(solPricing, {
    prompt_tokens: 300000,
    completion_tokens: 1000,
  });
  assert.equal(Math.round(cost * 1e6) / 1e6, 2.673);
});

test("computeCostFromPricing calculates short vs long context with cache read", () => {
  const solPricing = getPricingForModel("bedrock-mantle", "openai.gpt-5.6-sol");
  assert.ok(solPricing);

  // Short context cache read:
  // 100,000 prompt tokens, 80,000 cached
  // non-cached input: 20,000 * 4.40 / 1M = 0.088
  // cached input: 80,000 * 0.44 / 1M = 0.0352
  // total: 0.1232
  const shortCacheCost = computeCostFromPricing(solPricing, {
    prompt_tokens: 100000,
    completion_tokens: 0,
    cached_tokens: 80000,
  });
  assert.equal(Math.round(shortCacheCost * 1e6) / 1e6, 0.1232);

  // Long context cache read:
  // 500,000 prompt tokens (> 272K), 400,000 cached
  // non-cached input: 100,000 * 8.80 / 1M = 0.88
  // cached input: 400,000 * 0.88 / 1M = 0.352
  // total: 1.232
  const longCacheCost = computeCostFromPricing(solPricing, {
    prompt_tokens: 500000,
    completion_tokens: 0,
    cached_tokens: 400000,
  });
  assert.equal(Math.round(longCacheCost * 1e6) / 1e6, 1.232);
});

test("calculateCost async resolves bedrock-mantle with short and long context", async () => {
  // Short context: 10,000 tokens
  const shortCost = await calculateCost("bedrock-mantle", "openai.gpt-5.6-sol", {
    prompt_tokens: 10000,
    completion_tokens: 500,
  });
  // 10,000 * 4.4 / 1M = 0.044
  // 500 * 22.0 / 1M = 0.011
  // total = 0.055
  assert.equal(Math.round(shortCost * 1e6) / 1e6, 0.055);

  // Long context: 300,000 tokens
  const longCost = await calculateCost("bedrock-mantle", "openai.gpt-5.6-sol", {
    prompt_tokens: 300000,
    completion_tokens: 500,
  });
  // 300,000 * 8.8 / 1M = 2.64
  // 500 * 33.0 / 1M = 0.0165
  // total = 2.6565
  assert.equal(Math.round(longCost * 1e6) / 1e6, 2.6565);
});
