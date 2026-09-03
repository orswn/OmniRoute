import type { RegistryEntry } from "../../shared.ts";

export const bedrockMantleProvider: RegistryEntry = {
  id: "bedrock-mantle",
  alias: "mantle",
  format: "openai",
  executor: "bedrock-mantle",
  authType: "apikey",
  authHeader: "bearer",
  defaultContextLength: 200000,
  models: [
    {
      id: "openai.gpt-5.6-sol",
      name: "GPT-5.6 Sol (Bedrock Mantle)",
      toolCalling: true,
      supportsVision: true,
      contextLength: 200000,
    },
    {
      id: "openai.gpt-5.6-terra",
      name: "GPT-5.6 Terra (Bedrock Mantle)",
      toolCalling: true,
      supportsVision: true,
      contextLength: 200000,
    },
    {
      id: "openai.gpt-5.6-luna",
      name: "GPT-5.6 Luna (Bedrock Mantle)",
      toolCalling: true,
      supportsVision: true,
      contextLength: 200000,
    },
    {
      id: "openai.gpt-5.5",
      name: "GPT-5.5 (Bedrock Mantle)",
      toolCalling: true,
      supportsVision: true,
      contextLength: 200000,
    },
    {
      id: "openai.gpt-5.4",
      name: "GPT-5.4 (Bedrock Mantle)",
      toolCalling: true,
      supportsVision: true,
      contextLength: 200000,
    },
  ],
};
