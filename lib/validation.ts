import { z } from "zod";

export const allowedExtensions = [".stl", ".obj", ".3mf"];
export const maxFileSizeBytes = 50 * 1024 * 1024;

export const quoteInputSchema = z.object({
  customerName: z.string().min(2).max(120),
  email: z.email(),
  phone: z.string().max(50).optional().or(z.literal("")),
  material: z.enum(["PLA", "PETG", "ABS"]),
  colour: z.string().min(1).max(50),
  quantity: z.coerce.number().int().min(1).max(100),
  layerHeightMm: z.coerce.number().min(0.08).max(0.4),
  infillPercent: z.coerce.number().int().min(0).max(100),
  approxXmm: z.coerce.number().positive().max(1000),
  approxYmm: z.coerce.number().positive().max(1000),
  approxZmm: z.coerce.number().positive().max(1000),
  shippingMethod: z.enum(["pickup", "standard"])
});

export type QuoteInput = z.input<typeof quoteInputSchema>;
export type QuoteInputParsed = z.output<typeof quoteInputSchema>;

export function isAllowedFile(filename: string) {
  const lower = filename.toLowerCase();
  return allowedExtensions.some((ext) => lower.endsWith(ext));
}
