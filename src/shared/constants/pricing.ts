import { DEFAULT_PRICING } from "./pricing/default-pricing";
import { PROVIDER_ID_TO_ALIAS } from "@omniroute/open-sse/config/providerModels.ts";

export { DEFAULT_PRICING } from "./pricing/default-pricing";
// Default pricing rates for AI models
// All rates are in dollars per million tokens ($/1M tokens)
// Based on user-provided pricing for Antigravity models and industry standards for others

// Shared pricing constants to reduce duplication

type ProviderPricingTable = Record<string, Record<string, unknown>>;

function resolveProviderPricing(
  table: ProviderPricingTable,
  provider: string
): Record<string, unknown> | null {
  if (table[provider]) return table[provider];

  const alias = PROVIDER_ID_TO_ALIAS[provider];
  if (alias && table[alias]) return table[alias];

  for (const [canonicalId, mappedAlias] of Object.entries(PROVIDER_ID_TO_ALIAS)) {
    if (mappedAlias === provider && table[canonicalId]) {
      return table[canonicalId];
    }
  }

  const lower = provider.toLowerCase();
  for (const [key, val] of Object.entries(table)) {
    if (key.toLowerCase() === lower) return val;
    const keyAlias = PROVIDER_ID_TO_ALIAS[key];
    if (keyAlias && keyAlias.toLowerCase() === lower) return val;
  }

  return null;
}

/**
 * Get pricing for a specific provider and model
 * @param {string} provider - Provider ID (e.g., "openai", "cc", "antigravity")
 * @param {string} model - Model ID
 * @returns {object|null} Pricing object or null if not found
 */
export function getPricingForModel(
  provider: string,
  model: string
): Record<string, unknown> | null {
  if (!provider || !model) return null;

  const providerPricing = resolveProviderPricing(DEFAULT_PRICING as ProviderPricingTable, provider);
  if (!providerPricing) return null;

  const modelPricing = providerPricing[model];
  if (!modelPricing || typeof modelPricing !== "object") return null;
  return modelPricing as Record<string, unknown>;
}

/**
 * Get all pricing data
 * @returns {object} All default pricing
 */
export function getDefaultPricing() {
  return DEFAULT_PRICING;
}

export { formatCost } from "../utils/formatting";
