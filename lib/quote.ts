import type { QuoteInputParsed } from "@/lib/validation";

/**
 * Pricing model:
 *
 * 1. Actual printed volume = mesh volume × (shell + infill of interior) × 1.2 support factor
 * 2. Material cost = weight × filament $/g × quantity
 * 3. Machine cost = print time × machine $/hr × quantity
 * 4. Setup fee = per line item (once, not per unit)
 * 5. Support removal = 20% surcharge on (material + machine) if requested
 * 6. Minimum per line item
 * 7. GST 10%, shipping $15 AUD or $0 for pickup
 */

type MaterialConfig = {
  densityGPerCm3: number;
  filamentCostPerGramCents: number;
  machineRatePerHourCents: number;
  setupFeeCents: number;
  minimumLineCents: number;
};

const MATERIALS: Record<string, MaterialConfig> = {
  PLA:  { densityGPerCm3: 1.24, filamentCostPerGramCents: 6,  machineRatePerHourCents: 450, setupFeeCents: 200, minimumLineCents: 1200 },
  PETG: { densityGPerCm3: 1.27, filamentCostPerGramCents: 8,  machineRatePerHourCents: 500, setupFeeCents: 200, minimumLineCents: 1500 },
  ABS:  { densityGPerCm3: 1.04, filamentCostPerGramCents: 9,  machineRatePerHourCents: 550, setupFeeCents: 200, minimumLineCents: 1800 },
};

function estimatePrintTimeMinutes(
  printedVolumeCm3: number,
  layerHeightMm: number,
  infillPercent: number
): number {
  const volumeMm3 = printedVolumeCm3 * 1000;
  const baseFlowMm3PerSec = 9;
  const layerFactor = layerHeightMm / 0.2;
  const flowRate = baseFlowMm3PerSec * layerFactor;
  const infillSpeedPenalty = 1 + (infillPercent / 100) * 0.3;
  const printSeconds = (volumeMm3 / flowRate) * infillSpeedPenalty * 1.25;
  return Math.max(20, Math.round(printSeconds / 60));
}

export type ItemQuoteResult = {
  filename: string;
  material: string;
  colour: string;
  quantity: number;
  removeSupports: boolean;
  solidVolumeCm3: number;
  printedVolumeCm3: number;
  estimatedWeightGrams: number;
  estimatedPrintTimeMinutes: number;
  materialCostCents: number;
  machineCostCents: number;
  setupFeeCents: number;
  supportRemovalCents: number;
  itemTotalCents: number;
};

export type QuoteResult = {
  items: ItemQuoteResult[];
  subtotalCents: number;
  shippingCents: number;
  gstCents: number;
  totalCents: number;
};

export function calculateItemQuote(
  input: QuoteInputParsed,
  volumeMm3: number,
  filename: string
): ItemQuoteResult {
  const cfg = MATERIALS[input.material] ?? MATERIALS.PLA;

  const solidVolumeCm3 = volumeMm3 / 1000;

  const shellFraction = 0.30;
  const infillFraction = input.infillPercent / 100;
  const printedVolumeCm3 = Math.max(
    0.5,
    solidVolumeCm3 * (shellFraction + (1 - shellFraction) * infillFraction) * 1.20
  );

  const weightPerUnitGrams = parseFloat((printedVolumeCm3 * cfg.densityGPerCm3).toFixed(1));

  const materialCostCents = Math.round(weightPerUnitGrams * cfg.filamentCostPerGramCents) * input.quantity;

  const printTimePerUnit = estimatePrintTimeMinutes(printedVolumeCm3, input.layerHeightMm, input.infillPercent);

  const machineCostCents = Math.round((printTimePerUnit / 60) * cfg.machineRatePerHourCents) * input.quantity;

  const setupFeeCents = cfg.setupFeeCents;

  // Support removal: 20% surcharge on material + machine costs
  const supportRemovalCents = input.removeSupports
    ? Math.round((materialCostCents + machineCostCents) * 0.20)
    : 0;

  const rawTotal = materialCostCents + machineCostCents + setupFeeCents + supportRemovalCents;

  const itemTotalCents = Math.max(rawTotal, cfg.minimumLineCents);

  return {
    filename,
    material: input.material,
    colour: input.colour,
    quantity: input.quantity,
    removeSupports: input.removeSupports,
    solidVolumeCm3: parseFloat(solidVolumeCm3.toFixed(2)),
    printedVolumeCm3: parseFloat(printedVolumeCm3.toFixed(2)),
    estimatedWeightGrams: weightPerUnitGrams,
    estimatedPrintTimeMinutes: printTimePerUnit,
    materialCostCents,
    machineCostCents,
    setupFeeCents,
    supportRemovalCents,
    itemTotalCents,
  };
}

export function sumQuote(items: ItemQuoteResult[], shippingMethod: string): QuoteResult {
  const subtotalCents = items.reduce((s, i) => s + i.itemTotalCents, 0);
  const shippingCents = shippingMethod === "pickup" ? 0 : 1500;
  const gstCents = Math.round((subtotalCents + shippingCents) * 0.1);
  const totalCents = subtotalCents + shippingCents + gstCents;
  return { items, subtotalCents, shippingCents, gstCents, totalCents };
}
