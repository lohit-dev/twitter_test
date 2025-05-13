import { SuccessfulOrder, SwapMetrics } from "../types";

export interface ImageTemplate {
  name: string;
  description: string;
  generate(
    OrderData?: SuccessfulOrder | null,
    metrics?: SwapMetrics | null,
  ): Promise<string>;
}

export interface TemplateOptions {
  width?: number;
  height?: number;
  backgroundColor?: string;
  textColor?: string;
}
