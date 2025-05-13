import { SuccessfulOrder, SwapMetrics } from "../types";
import { TemplateName } from "../utils/image_generator";
import { ImageTemplate } from "./base";
import minimalTemplate from "./minimal";
import orderTemplate from "./order";

const templates: Record<string, ImageTemplate> = {
  minimal: minimalTemplate,
  order: orderTemplate,
};

export function getTemplate(name: string): ImageTemplate {
  const template = templates[name];
  if (!template) {
    throw new Error(
      `Template '${name}' not found. Available templates: ${Object.keys(templates).join(", ")}`,
    );
  }
  return template;
}

export function listTemplates(): ImageTemplate[] {
  return Object.values(templates);
}

export async function generateImage(
  templateName: TemplateName,
  OrderData?: SuccessfulOrder | null,
  metrics?: SwapMetrics | null,
): Promise<string> {
  const template = getTemplate(templateName);
  if (OrderData != null) {
    return template.generate(OrderData, null);
  } else {
    return template.generate(null, metrics);
  }
}

export { ImageTemplate };
