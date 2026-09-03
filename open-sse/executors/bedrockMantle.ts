import { DefaultExecutor } from "./default.ts";
import type { ProviderCredentials, ExecutorExecuteResult } from "./base.ts";
import {
  signBedrockMantleRequest,
  resolveBedrockMantleRegion,
  buildBedrockMantleBaseUrl,
} from "../services/bedrockMantleAuth.ts";
import { normalizeMantlePayload } from "../utils/bedrockMantlePayload.ts";

export class BedrockMantleExecutor extends DefaultExecutor {
  constructor() {
    super("bedrock-mantle");
  }

  override buildUrl(
    _model: string,
    _stream: boolean,
    _urlIndex = 0,
    credentials: ProviderCredentials | null = null
  ): string {
    const configuredBase = credentials?.providerSpecificData?.baseUrl;
    if (typeof configuredBase === "string" && configuredBase.trim().length > 0) {
      const clean = configuredBase.trim().replace(/\/+$/, "");
      return `${clean}/chat/completions`;
    }
    const region = resolveBedrockMantleRegion(credentials?.providerSpecificData);
    const base = buildBedrockMantleBaseUrl(region);
    return `${base}/chat/completions`;
  }

  override transformRequest(
    model: string,
    body: unknown,
    stream: boolean,
    credentials: ProviderCredentials
  ): unknown {
    const transformed = super.transformRequest(model, body, stream, credentials);
    return normalizeMantlePayload(transformed);
  }

  override async execute({
    model,
    body,
    stream,
    credentials,
    signal,
  }: {
    model: string;
    body: unknown;
    stream: boolean;
    credentials: ProviderCredentials;
    signal?: AbortSignal;
    log?: unknown;
  }): Promise<ExecutorExecuteResult> {
    const url = this.buildUrl(model, stream, 0, credentials);
    const transformedBody = this.transformRequest(model, body, stream, credentials);
    const serializedBody =
      typeof transformedBody === "string" ? transformedBody : JSON.stringify(transformedBody);

    const baseHeaders = this.buildHeaders(credentials, stream);
    baseHeaders["content-type"] = "application/json";

    const signedHeaders = await signBedrockMantleRequest({
      method: "POST",
      url,
      headers: baseHeaders,
      body: serializedBody,
      providerSpecificData: credentials?.providerSpecificData,
      apiKey: credentials?.apiKey,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: signedHeaders,
      body: serializedBody,
      signal: signal || undefined,
    });

    return {
      response,
      url,
      headers: signedHeaders,
      transformedBody,
    };
  }
}

export default BedrockMantleExecutor;
