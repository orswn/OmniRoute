/**
 * #5477 — the combo builder's per-model option construction was extracted into a
 * shared `buildModelOptions` helper (one source of truth for the synced /
 * built-in / custom / fallback branches). This test drives the real builder and
 * locks the custom-model **source classification** branch: a custom model whose
 * stored `source` is one of api-sync/auto-sync/imported must surface as
 * `imported`, everything else as `custom`. A silent divergence in that mapping is
 * exactly what the extraction could introduce.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-combo-source-"));
process.env.DATA_DIR = TEST_DATA_DIR;

const core = await import("../../src/lib/db/core.ts");
const modelsDb = await import("../../src/lib/db/models.ts");
const { getComboBuilderOptions } = await import("../../src/lib/combos/builderOptions.ts");

test.after(() => {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

test("#5477 buildModelOptions classifies custom-model source (manual -> custom, api-sync -> imported)", async () => {
  // Attach to a no-auth provider ("opencode") — it surfaces in the builder
  // without a configured connection, so the custom-model branch is exercised.
  await modelsDb.addCustomModel("opencode", "zzz-manual-5477", "Manual 5477", "manual");
  await modelsDb.addCustomModel("opencode", "zzz-apisync-5477", "ApiSync 5477", "api-sync");

  const payload = await getComboBuilderOptions();

  const allModels = payload.providers.flatMap((p) => p.models);
  const manual = allModels.find((m) => m.id === "zzz-manual-5477");
  const apiSync = allModels.find((m) => m.id === "zzz-apisync-5477");

  assert.ok(manual, "manual custom model must appear in the combo builder output");
  assert.ok(apiSync, "api-sync custom model must appear in the combo builder output");

  assert.equal(manual.source, "custom", "source=manual must classify as 'custom'");
  assert.equal(apiSync.source, "imported", "source=api-sync must classify as 'imported'");
});

test("custom model where name equals id does not overwrite friendly system display name", async () => {
  const providersDb = await import("../../src/lib/db/providers.ts");
  await providersDb.createProviderConnection({
    provider: "bedrock-mantle",
    authType: "apikey",
    name: "bedrock-mantle-test",
    apiKey: "test-key",
    isActive: true,
    testStatus: "active",
  });

  // Add custom model with id === name, matching an existing system model
  await modelsDb.addCustomModel(
    "bedrock-mantle",
    "openai.gpt-6-astra",
    "openai.gpt-6-astra",
    "manual"
  );

  const payload = await getComboBuilderOptions();
  const mantleProvider = payload.providers.find((p) => p.providerId === "bedrock-mantle");
  assert.ok(mantleProvider, "bedrock-mantle provider must appear in builder options");

  const astraModel = mantleProvider.models.find((m) => m.id === "openai.gpt-6-astra");
  assert.ok(astraModel, "openai.gpt-6-astra must appear in models list");
  assert.equal(
    astraModel.name,
    "GPT-6 Astra",
    "System display name 'GPT-6 Astra' must not be clobbered by raw id from custom model"
  );
});
