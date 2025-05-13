import { SwapMetrics } from "../types";
import { ImageTemplate } from "./base";
import standardTemplate from "./standard";
import minimalTemplate from "./minimal";
import orderTemplate from "./order";

const templates: Record<string, ImageTemplate> = {
  standard: standardTemplate,
  minimal: minimalTemplate,
  order: orderTemplate,
};

export function getTemplate(name: string): ImageTemplate {
  const template = templates[name];
  if (!template) {
    throw new Error(
      `Template '${name}' not found. Available templates: ${Object.keys(templates).join(", ")}`
    );
  }
  return template;
}

export function listTemplates(): ImageTemplate[] {
  return Object.values(templates);
}

export async function generateImage(
  templateName: string,
  metrics: SwapMetrics
): Promise<string> {
  const template = getTemplate(templateName);
  return template.generate(metrics);
}

export { ImageTemplate };
