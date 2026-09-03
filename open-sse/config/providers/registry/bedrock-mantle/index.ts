import { GPT_5_6_API_CAPABILITIES, type RegistryEntry } from "../../shared.ts";

export const bedrockMantleProvider: RegistryEntry = {
  id: "bedrock-mantle",
  alias: "mantle",
  format: "openai",
  executor: "bedrock-mantle",
  authType: "apikey",
  authHeader: "bearer",
  defaultContextLength: 1050000,
  models: [
    {
      id: "openai.gpt-5.6-sol",
      name: "GPT-5.6 Sol (Bedrock Mantle)",
      ...GPT_5_6_API_CAPABILITIES,
    },
    {
      id: "openai.gpt-5.6-terra",
      name: "GPT-5.6 Terra (Bedrock Mantle)",
      ...GPT_5_6_API_CAPABILITIES,
    },
    {
      id: "openai.gpt-5.6-luna",
      name: "GPT-5.6 Luna (Bedrock Mantle)",
      ...GPT_5_6_API_CAPABILITIES,
    },
    {
      id: "openai.gpt-5.5",
      name: "GPT-5.5 (Bedrock Mantle)",
      toolCalling: true,
      supportsVision: true,
      contextLength: 272000,
      maxOutputTokens: 128000,
    },
    {
      id: "openai.gpt-5.4",
      name: "GPT-5.4 (Bedrock Mantle)",
      toolCalling: true,
      supportsVision: true,
      contextLength: 272000,
      maxOutputTokens: 128000,
    },
  ],
};
