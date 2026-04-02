import { z } from "zod";

export const allowedExtensions = [".stl"];
export const maxFileSizeBytes = 50 * 1024 * 1024;

// Per-file item settings
export const fileItemSchema = z.object({
  material: z.enum(["PLA", "PETG", "ABS"]),
  colour: z.string().min(1).max(50),
  quantity: z.coerce.number().int().min(1).max(100),
  layerHeightMm: z.coerce.number().min(0.08).max(0.4),
  infillPercent: z.coerce.number().int().min(5).max(100),
  removeSupports: z.boolean().default(false),
});

// Contact (always required)
export const orderContactSchema = z.object({
  customerName: z.string().min(2).max(120),
  email: z.email(),
  shippingMethod: z.enum(["shipping", "pickup"]),
  // Address fields required only for shipping — validated in the API route
  shippingAddressLine1: z.string().max(200).optional().or(z.literal("")),
  shippingAddressLine2: z.string().max(100).optional().or(z.literal("")),
  shippingCity: z.string().max(100).optional().or(z.literal("")),
  shippingState: z.string().max(10).optional().or(z.literal("")),
  shippingPostcode: z.string().max(10).optional().or(z.literal("")),
  shippingCountry: z.literal("AU").optional(),
});

export type FileItemInput = z.infer<typeof fileItemSchema>;
export type OrderContactInput = z.infer<typeof orderContactSchema>;

// Keep for backward compat in quote.ts
export type QuoteInputParsed = FileItemInput;

export function isAllowedFile(filename: string) {
  const lower = filename.toLowerCase();
  return allowedExtensions.some((ext) => lower.endsWith(ext));
}
