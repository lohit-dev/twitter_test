import { SwapMetrics } from "../types";

export interface ImageTemplate {
  name: string;
  description: string;
  generate(metrics: SwapMetrics): Promise<string>;
}

export interface TemplateOptions {
  width?: number;
  height?: number;
  backgroundColor?: string;
  textColor?: string;
}
