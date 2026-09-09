import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { signAwsRequest, type AwsSigV4Credentials } from "../utils/awsSigV4.ts";
import { normalizeBedrockRegion } from "../config/bedrock.ts";

export interface ResolvedAwsSigV4Creds extends AwsSigV4Credentials {
  source: "explicit" | "provider-chain";
}

function getTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function isAstraModel(model?: string | null): boolean {
  if (!model) return false;
  const clean = model.toLowerCase();
  return clean.includes("gpt-6-astra") || clean === "astra" || clean.endsWith(".gpt-6-astra");
}

export function resolveBedrockMantleRegion(
  providerSpecificData: unknown,
  model?: string | null
): string {
  const data =
    providerSpecificData && typeof providerSpecificData === "object"
      ? (providerSpecificData as Record<string, unknown>)
      : {};

  const modelRegions =
    (data.modelRegions as Record<string, unknown> | undefined) ||
    (data.model_regions as Record<string, unknown> | undefined);
  if (model && modelRegions && typeof modelRegions === "object") {
    const custom =
      getTrimmedString(modelRegions[model]) ||
      (isAstraModel(model) ? getTrimmedString(modelRegions["openai.gpt-6-astra"]) : null);
    if (custom) return normalizeBedrockRegion(custom);
  }

  if (isAstraModel(model)) {
    const astraExplicit =
      getTrimmedString(data.astraRegion) ||
      getTrimmedString(data.astra_region) ||
      getTrimmedString(process.env.PI_BEDROCK_MANTLE_ASTRA_REGION) ||
      getTrimmedString(process.env.BEDROCK_MANTLE_ASTRA_REGION);
    if (astraExplicit) return normalizeBedrockRegion(astraExplicit);

    return "us-west-2";
  }

  const explicit =
    getTrimmedString(data.region) ||
    getTrimmedString(data.awsRegion) ||
    getTrimmedString(process.env.PI_BEDROCK_MANTLE_REGION) ||
    getTrimmedString(process.env.AWS_REGION) ||
    getTrimmedString(process.env.AWS_DEFAULT_REGION);

  if (explicit) return normalizeBedrockRegion(explicit);

  const baseUrl = getTrimmedString(data.baseUrl);
  if (baseUrl) {
    try {
      const match = new URL(baseUrl).hostname.match(/^bedrock-mantle\.([a-z0-9-]+)\./i);
      if (match?.[1]) return normalizeBedrockRegion(match[1]);
    } catch {
      // fallback to default
    }
  }

  return "us-east-1";
}

export function buildBedrockMantleBaseUrl(region: string): string {
  return `https://bedrock-mantle.${normalizeBedrockRegion(region)}.api.aws/openai/v1`;
}

export async function resolveAwsSigV4Credentials(
  providerSpecificData: unknown,
  apiKey?: string | null
): Promise<ResolvedAwsSigV4Creds> {
  const data =
    providerSpecificData && typeof providerSpecificData === "object"
      ? (providerSpecificData as Record<string, unknown>)
      : {};

  const explicitAccessKeyId =
    getTrimmedString(data.accessKeyId) || getTrimmedString(data.awsAccessKeyId);
  const explicitSecretAccessKey =
    getTrimmedString(apiKey) ||
    getTrimmedString(data.secretAccessKey) ||
    getTrimmedString(data.awsSecretAccessKey);
  const sessionToken =
    getTrimmedString(data.sessionToken) ||
    getTrimmedString(data.awsSessionToken) ||
    getTrimmedString(process.env.AWS_SESSION_TOKEN);

  if (explicitAccessKeyId && explicitSecretAccessKey) {
    return {
      accessKeyId: explicitAccessKeyId,
      secretAccessKey: explicitSecretAccessKey,
      sessionToken: sessionToken ?? undefined,
      source: "explicit",
    };
  }

  const profile =
    getTrimmedString(data.profile) ||
    getTrimmedString(data.awsProfile) ||
    getTrimmedString(process.env.PI_BEDROCK_MANTLE_PROFILE) ||
    getTrimmedString(process.env.AWS_PROFILE);

  const chainProvider = defaultProvider(profile ? { profile } : {});

  const loaded = await chainProvider();
  return {
    accessKeyId: loaded.accessKeyId,
    secretAccessKey: loaded.secretAccessKey,
    sessionToken: loaded.sessionToken,
    source: "provider-chain",
  };
}

export async function signBedrockMantleRequest(options: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string | null;
  providerSpecificData?: unknown;
  apiKey?: string | null;
  now?: Date;
  model?: string | null;
}): Promise<Record<string, string>> {
  let region: string;
  try {
    const match = new URL(options.url).hostname.match(/^bedrock-mantle\.([a-z0-9-]+)\./i);
    if (match?.[1]) {
      region = normalizeBedrockRegion(match[1]);
    } else {
      region = resolveBedrockMantleRegion(options.providerSpecificData, options.model);
    }
  } catch {
    region = resolveBedrockMantleRegion(options.providerSpecificData, options.model);
  }
  const creds = await resolveAwsSigV4Credentials(options.providerSpecificData, options.apiKey);

  return signAwsRequest({
    method: options.method,
    url: options.url,
    region,
    service: "bedrock-mantle",
    headers: options.headers || {},
    body: options.body ?? "",
    credentials: creds,
    now: options.now,
  });
}
