export type ModelMetadataRow = {
  id: string;
  [key: string]: unknown;
};

/**
 * Overlay fields explicitly stored on a custom model without erasing richer
 * discovered metadata for fields the custom row does not define.
 */
export function mergeCustomModelMetadata<T extends Record<string, unknown>>(
  base: T,
  custom: Record<string, unknown>
): T {
  const definedCustom = Object.fromEntries(
    Object.entries(custom).filter(([, value]) => value !== undefined)
  );
  if (
    typeof custom.id === "string" &&
    custom.name === custom.id &&
    typeof base.name === "string" &&
    base.name !== base.id
  ) {
    delete definedCustom.name;
  }
  return { ...base, ...definedCustom } as T;
}

export function mergeModelsWithCustomPrecedence<T extends ModelMetadataRow>(
  baseModels: T[],
  customModels: ModelMetadataRow[]
): T[] {
  const merged = new Map(baseModels.map((model) => [model.id, model]));
  for (const custom of customModels) {
    const existing = merged.get(custom.id);
    merged.set(custom.id, existing ? mergeCustomModelMetadata(existing, custom) : (custom as T));
  }
  return Array.from(merged.values());
}
