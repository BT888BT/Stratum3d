import type { QuoteInputParsed } from "@/lib/validation";

/**
 * Pricing model:
 *
 * 1. Actual printed volume = mesh volume × (shell + infill of interior) × 1.2 support factor
 * 2. Material cost = weight × filament $/g × quantity
 * 3. Machine cost = print time × machine $/hr × quantity
 * 4. Setup fee = per line item (once, not per unit)
 * 5. Support removal = 20% surcharge on (material + machine) if requested
 * 6. Height surcharge = 0/5/10/15% on (material + machine) for ≤50/≤100/≤200/>200 mm tall models
 * 7. Minimum per line item
 * 7. GST 10%, shipping $15 AUD or $0 for pickup
 * 8. PRICE_MULTIPLIER env var scales the final item total (e.g. 0.9 = 10% discount)
 */

type MaterialConfig = {
  densityGPerCm3: number;
  filamentCostPerGramCents: number;
  machineRatePerHourCents: number;
  setupFeeCents: number;
  minimumLineCents: number;
};

const MINIMUM_LINE_CENTS = parseInt(process.env.MINIMUM_LINE_CENTS ?? "100");

const MATERIAL_COST_PER_GRAM_CENTS = 4; // $0.04/g = $40/kg
const MACHINE_RATE_PER_HOUR_CENTS = 200; // $2.00/hr, all materials

const MATERIALS: Record<string, MaterialConfig> = {
  PLA:  { densityGPerCm3: 1.24, filamentCostPerGramCents: MATERIAL_COST_PER_GRAM_CENTS, machineRatePerHourCents: MACHINE_RATE_PER_HOUR_CENTS, setupFeeCents: 200, minimumLineCents: MINIMUM_LINE_CENTS },
  PETG: { densityGPerCm3: 1.27, filamentCostPerGramCents: MATERIAL_COST_PER_GRAM_CENTS, machineRatePerHourCents: MACHINE_RATE_PER_HOUR_CENTS, setupFeeCents: 200, minimumLineCents: MINIMUM_LINE_CENTS },
  ABS:  { densityGPerCm3: 1.04, filamentCostPerGramCents: MATERIAL_COST_PER_GRAM_CENTS, machineRatePerHourCents: MACHINE_RATE_PER_HOUR_CENTS, setupFeeCents: 200, minimumLineCents: MINIMUM_LINE_CENTS },
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
  heightSurchargeCents: number;
  itemTotalCents: number;
};

export type QuoteResult = {
  items: ItemQuoteResult[];
  subtotalCents: number;
  shippingCents: number;
  gstCents: number;
  totalCents: number;
};

/**
 * Height surcharge tiers (applied to material + machine costs):
 *   ≤ 50 mm  → 0%
 *   51–100 mm → 5%
 *   101–200 mm → 10%
 *   > 200 mm  → 15%
 */
function heightSurchargeFactor(heightMm: number): number {
  if (heightMm <= 50)  return 0;
  if (heightMm <= 100) return 0.05;
  if (heightMm <= 200) return 0.10;
  return 0.15;
}

export function calculateItemQuote(
  input: QuoteInputParsed,
  volumeMm3: number,
  filename: string,
  heightMm = 0
): ItemQuoteResult {
  const cfg = MATERIALS[input.material] ?? MATERIALS.PLA;

  const solidVolumeCm3 = volumeMm3 / 1000;

  // volume × infill density × support factor × $0.04/g
  const infillFraction = input.infillPercent / 100;
  const supportFactor = input.removeSupports ? 1.20 : 1.0;
  const printedVolumeCm3 = Math.max(0.5, solidVolumeCm3 * infillFraction * supportFactor);

  const weightPerUnitGrams = parseFloat((printedVolumeCm3 * cfg.densityGPerCm3).toFixed(1));

  const materialCostCents = Math.round(weightPerUnitGrams * cfg.filamentCostPerGramCents) * input.quantity;

  const printTimePerUnit = estimatePrintTimeMinutes(printedVolumeCm3, input.layerHeightMm, input.infillPercent);

  const machineCostCents = Math.round((printTimePerUnit / 60) * cfg.machineRatePerHourCents) * input.quantity;

  const setupFeeCents = cfg.setupFeeCents;

  // Support removal: 20% surcharge on material + machine costs
  const supportRemovalCents = input.removeSupports
    ? Math.round((materialCostCents + machineCostCents) * 0.20)
    : 0;

  // Height surcharge: tall models take longer to print due to more layers
  const heightSurchargeCents = Math.round(
    (materialCostCents + machineCostCents) * heightSurchargeFactor(heightMm)
  );

  const rawTotal = materialCostCents + machineCostCents + setupFeeCents + supportRemovalCents + heightSurchargeCents;

  const priceMultiplier = parseFloat(process.env.PRICE_MULTIPLIER ?? "1");
  const itemTotalCents = Math.max(Math.round(rawTotal * priceMultiplier), cfg.minimumLineCents);

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
    heightSurchargeCents,
    itemTotalCents,
  };
}

export function sumQuote(items: ItemQuoteResult[], shippingMethod: string): QuoteResult {
  const subtotalCents = items.reduce((s, i) => s + i.itemTotalCents, 0);
  const shippingCents = shippingMethod === "pickup" ? 250 : 1500;
  const gstCents = Math.round((subtotalCents + shippingCents) * 0.1);
  const totalCents = subtotalCents + shippingCents + gstCents;
  return { items, subtotalCents, shippingCents, gstCents, totalCents };
}
