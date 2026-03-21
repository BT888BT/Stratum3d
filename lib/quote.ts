import type { QuoteInput } from "@/lib/validation";

type PricingConfig = {
  materialRatePerCm3Cents: number;
  machineRatePerHourCents: number;
  setupFeeCents: number;
  minimumOrderCents: number;
};

const pricingByMaterial: Record<QuoteInput["material"], PricingConfig> = {
  PLA: {
    materialRatePerCm3Cents: 35,
    machineRatePerHourCents: 800,
    setupFeeCents: 500,
    minimumOrderCents: 2500
  },
  PETG: {
    materialRatePerCm3Cents: 42,
    machineRatePerHourCents: 900,
    setupFeeCents: 600,
    minimumOrderCents: 3000
  },
  ABS: {
    materialRatePerCm3Cents: 48,
    machineRatePerHourCents: 1000,
    setupFeeCents: 700,
    minimumOrderCents: 3500
  }
};

export type QuoteResult = {
  estimatedVolumeCm3: number;
  estimatedPrintTimeMinutes: number;
  subtotalCents: number;
  shippingCents: number;
  gstCents: number;
  totalCents: number;
};

export function calculateQuote(input: QuoteInput): QuoteResult {
  const pricing = pricingByMaterial[input.material];

  const boundingBoxCm3 =
    (input.approxXmm * input.approxYmm * input.approxZmm) / 1000;

  const estimatedVolumeCm3 = Math.max(1, boundingBoxCm3 * 0.22);
  const estimatedPrintTimeMinutes = Math.max(
    30,
    Math.round(
      estimatedVolumeCm3 * 2.8 +
        input.infillPercent * 1.2 +
        (0.28 - input.layerHeightMm) * 500
    )
  );

  const materialCost =
    Math.round(estimatedVolumeCm3 * pricing.materialRatePerCm3Cents) *
    input.quantity;

  const machineHours = estimatedPrintTimeMinutes / 60;
  const machineCost =
    Math.round(machineHours * pricing.machineRatePerHourCents) * input.quantity;

  const baseCost = materialCost + machineCost + pricing.setupFeeCents;
  const subtotalCents = Math.max(baseCost, pricing.minimumOrderCents);

  const shippingCents = input.shippingMethod === "pickup" ? 0 : 1500;
  const gstCents = Math.round(subtotalCents * 0.1);
  const totalCents = subtotalCents + gstCents + shippingCents;

  return {
    estimatedVolumeCm3: Number(estimatedVolumeCm3.toFixed(2)),
    estimatedPrintTimeMinutes,
    subtotalCents,
    shippingCents,
    gstCents,
    totalCents
  };
}
