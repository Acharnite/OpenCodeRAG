import type { DescriptionProvider } from "../core/interfaces.js";
import type { DescriptionConfig } from "../core/config.js";
import { LLMDescriptionProvider } from "./describer.js";

export function createDescriptionProvider(
  config: DescriptionConfig
): DescriptionProvider {
  return new LLMDescriptionProvider(config);
}
