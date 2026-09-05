import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveBedrockMantleRegion,
  buildBedrockMantleBaseUrl,
  resolveAwsSigV4Credentials,
  signBedrockMantleRequest,
} from "../../open-sse/services/bedrockMantleAuth.ts";
import {
  normalizeMantlePayload,
  validateMantleThinkingSignatures,
  MantlePayloadError,
} from "../../open-sse/utils/bedrockMantlePayload.ts";
import { getModelTargetFormat } from "../../open-sse/config/providerModels.ts";
import { BedrockMantleExecutor } from "../../open-sse/executors/bedrockMantle.ts";
import type { ProviderCredentials } from "../../open-sse/executors/base.ts";

test("Bedrock Mantle region and URL resolution", () => {
  assert.equal(resolveBedrockMantleRegion({ region: "us-west-2" }), "us-west-2");
  assert.equal(resolveBedrockMantleRegion({ awsRegion: "eu-central-1" }), "eu-central-1");
  assert.equal(
    resolveBedrockMantleRegion({
      baseUrl: "https://bedrock-mantle.ap-northeast-1.api.aws/openai/v1",
    }),
    "ap-northeast-1"
  );
  assert.equal(resolveBedrockMantleRegion({}), "us-east-1");

  assert.equal(
    buildBedrockMantleBaseUrl("us-west-2"),
    "https://bedrock-mantle.us-west-2.api.aws/openai/v1"
  );
});

test("Bedrock Mantle AWS SigV4 credential resolution and signing", async () => {
  const creds = await resolveAwsSigV4Credentials(
    { accessKeyId: "AKIA_TEST", sessionToken: "TOKEN_TEST" },
    "SECRET_TEST"
  );

  assert.equal(creds.source, "explicit");
  assert.equal(creds.accessKeyId, "AKIA_TEST");
  assert.equal(creds.secretAccessKey, "SECRET_TEST");
  assert.equal(creds.sessionToken, "TOKEN_TEST");

  const fixedDate = new Date("2026-09-03T12:00:00.000Z");
  const signed = await signBedrockMantleRequest({
    method: "POST",
    url: "https://bedrock-mantle.us-east-1.api.aws/openai/v1/chat/completions",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: "openai.gpt-5.6-sol" }),
    providerSpecificData: { accessKeyId: "AKIA_TEST", region: "us-east-1" },
    apiKey: "SECRET_TEST",
    now: fixedDate,
  });

  assert.match(
    signed.Authorization,
    /^AWS4-HMAC-SHA256 Credential=AKIA_TEST\/20260903\/us-east-1\/bedrock-mantle\/aws4_request/
  );
  assert.equal(signed["x-amz-date"], "20260903T120000Z");
  assert.ok(signed["x-amz-content-sha256"]);
});

test("Bedrock Mantle payload normalization", () => {
  const passThrough = normalizeMantlePayload({ model: "claude-3-5-sonnet", input: [] });
  assert.deepEqual(passThrough, { model: "claude-3-5-sonnet", input: [] });

  const payload = {
    model: "openai.gpt-5.6-sol",
    store: false,
    max_output_tokens: 4096,
    prompt_cache_retention: "24h",
    reasoning: { summary: "none", effort: "high" },
    input: [
      { role: "developer", content: "system instructions" },
      { role: "user", content: [{ type: "input_text", text: "hello" }] },
    ],
  };

  const normalized = normalizeMantlePayload(payload) as Record<string, unknown>;
  assert.equal(normalized.max_output_tokens, undefined);
  assert.equal(normalized.prompt_cache_retention, undefined);
  assert.equal(normalized.instructions, "system instructions");
  assert.deepEqual(normalized.reasoning, { effort: "high" });
  assert.equal((normalized.text as Record<string, unknown>)?.verbosity, "low");
});

test("Bedrock Mantle reasoning signature validation", () => {
  assert.throws(
    () =>
      validateMantleThinkingSignatures([
        {
          provider: "bedrock-mantle",
          model: "openai.gpt-5.6-sol",
          content: [{ type: "thinking", thinkingSignature: "invalid-json" }],
        },
      ]),
    (err: unknown) => err instanceof MantlePayloadError
  );

  assert.doesNotThrow(() =>
    validateMantleThinkingSignatures([
      {
        provider: "bedrock-mantle",
        model: "openai.gpt-5.6-sol",
        content: [
          {
            type: "thinking",
            thinkingSignature: JSON.stringify({
              type: "reasoning",
              id: "rs_1",
              encrypted_content: "enc_1",
            }),
          },
        ],
      },
    ])
  );
});

test("BedrockMantleExecutor routes GPT-5.6 through Responses", () => {
  const executor = new BedrockMantleExecutor();
  assert.equal(executor.getProvider(), "bedrock-mantle");
  assert.equal(getModelTargetFormat("bedrock-mantle", "openai.gpt-5.6-sol"), "openai-responses");

  const defaultUrl = executor.buildUrl("openai.gpt-5.6-sol", false, 0, null);
  assert.equal(defaultUrl, "https://bedrock-mantle.us-east-1.api.aws/openai/v1/responses");

  const customRegionUrl = executor.buildUrl("openai.gpt-5.6-sol", false, 0, {
    providerSpecificData: { region: "eu-west-1" },
  } as unknown as ProviderCredentials);
  assert.equal(customRegionUrl, "https://bedrock-mantle.eu-west-1.api.aws/openai/v1/responses");

  const legacyUrl = executor.buildUrl("openai.gpt-5.5", false, 0, null);
  assert.equal(legacyUrl, "https://bedrock-mantle.us-east-1.api.aws/openai/v1/chat/completions");
});

test("Bedrock Mantle GPT-5.6 models declare supported thinking efforts", async () => {
  const { bedrockMantleProvider } =
    await import("../../open-sse/config/providers/registry/bedrock-mantle/index.ts");
  const { getThinkingCapabilityFields } =
    await import("../../src/app/api/v1/models/catalogHelpers.ts");

  const sol = bedrockMantleProvider.models.find((m) => m.id === "openai.gpt-5.6-sol");
  assert.ok(sol, "openai.gpt-5.6-sol must exist in bedrockMantleProvider.models");
  assert.equal(sol.supportsReasoning, true);
  assert.deepEqual(sol.supportedThinkingEfforts, ["low", "medium", "high", "xhigh", "max"]);

  const terra = bedrockMantleProvider.models.find((m) => m.id === "openai.gpt-5.6-terra");
  assert.ok(terra, "openai.gpt-5.6-terra must exist in bedrockMantleProvider.models");
  assert.equal(terra.supportsReasoning, true);
  assert.deepEqual(terra.supportedThinkingEfforts, ["low", "medium", "high", "xhigh", "max"]);

  const luna = bedrockMantleProvider.models.find((m) => m.id === "openai.gpt-5.6-luna");
  assert.ok(luna, "openai.gpt-5.6-luna must exist in bedrockMantleProvider.models");
  assert.equal(luna.supportsReasoning, true);
  assert.deepEqual(luna.supportedThinkingEfforts, ["low", "medium", "high", "xhigh", "max"]);

  const fields = getThinkingCapabilityFields(
    "bedrock-mantle",
    sol.id,
    sol.supportsReasoning,
    sol.supportedThinkingEfforts,
    false
  );
  assert.equal(fields.thinking, true);
  assert.equal(fields.supportsThinking, true);
  assert.deepEqual(fields.effort_tiers, ["low", "medium", "high", "xhigh", "max"]);
});
