import type { QuoteInputParsed } from "@/lib/validation";

/**
 * Pricing model:
 *
 * 1. Actual printed volume = mesh volume × (shell fraction + infill fraction of interior) × 1.2 support factor
 * 2. Material cost = weight × filament cost per gram × quantity
 * 3. Machine cost = print time × machine rate per hour × quantity
 * 4. Per-job setup fee covers slicing, QA, machine setup (charged once per line item, not per qty)
 * 5. Minimum PER LINE ITEM (not per quantity unit) — avoids hiding quantity scaling
 * 6. GST 10%, flat shipping $15 AUD per order
 *
 * Machine rate reflects realistic FDM service pricing:
 * - Electricity + machine depreciation + operator time = ~$4–5/hr
 */

type MaterialConfig = {
  densityGPerCm3: number;
  filamentCostPerGramCents: number; // cents per gram of raw filament
  machineRatePerHourCents: number;  // cents per hour of print time
  setupFeeCents: number;            // per line item (not per unit)
  minimumLineCents: number;         // minimum per line item
};

const MATERIALS: Record<string, MaterialConfig> = {
  PLA:  { densityGPerCm3: 1.24, filamentCostPerGramCents: 6,  machineRatePerHourCents: 450, setupFeeCents: 200, minimumLineCents: 1200 },
  PETG: { densityGPerCm3: 1.27, filamentCostPerGramCents: 8,  machineRatePerHourCents: 500, setupFeeCents: 200, minimumLineCents: 1500 },
  ABS:  { densityGPerCm3: 1.04, filamentCostPerGramCents: 9,  machineRatePerHourCents: 550, setupFeeCents: 200, minimumLineCents: 1800 },
};

/**
 * Print time model — based on volume flow rate through nozzle.
 * A 0.4mm nozzle at typical service speeds moves ~8–10mm³/s of material.
 * Higher layer height = faster. Higher infill = more material = slower.
 * +25% overhead for travel, retracts, layer changes, cooling.
 */
function estimatePrintTimeMinutes(
  printedVolumeCm3: number,
  layerHeightMm: number,
  infillPercent: number
): number {
  const volumeMm3 = printedVolumeCm3 * 1000;

  // Flow rate: base 9mm³/s, scaled by layer height
  const baseFlowMm3PerSec = 9;
  const layerFactor = layerHeightMm / 0.2; // 0.2mm is reference
  const flowRate = baseFlowMm3PerSec * layerFactor;

  // Infill slows down due to more material per layer
  const infillSpeedPenalty = 1 + (infillPercent / 100) * 0.3;

  const printSeconds = (volumeMm3 / flowRate) * infillSpeedPenalty * 1.25;
  return Math.max(20, Math.round(printSeconds / 60));
}

export type ItemQuoteResult = {
  filename: string;
  material: string;
  colour: string;
  quantity: number;
  solidVolumeCm3: number;
  printedVolumeCm3: number;
  estimatedWeightGrams: number;
  estimatedPrintTimeMinutes: number; // per unit
  materialCostCents: number;         // total for all qty
  machineCostCents: number;          // total for all qty
  setupFeeCents: number;             // once per line
  itemTotalCents: number;            // final line total
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

  // Solid volume from mesh
  const solidVolumeCm3 = volumeMm3 / 1000;

  // Printed volume: shells are always solid (30% of bounding volume),
  // interior uses infill %, then +20% for support material
  const shellFraction = 0.30;
  const infillFraction = input.infillPercent / 100;
  const printedVolumeCm3 = Math.max(
    0.5,
    solidVolumeCm3 * (shellFraction + (1 - shellFraction) * infillFraction) * 1.20
  );

  // Weight per unit
  const weightPerUnitGrams = parseFloat((printedVolumeCm3 * cfg.densityGPerCm3).toFixed(1));

  // Material cost × quantity
  const materialCostCents = Math.round(weightPerUnitGrams * cfg.filamentCostPerGramCents) * input.quantity;

  // Print time per unit
  const printTimePerUnit = estimatePrintTimeMinutes(printedVolumeCm3, input.layerHeightMm, input.infillPercent);

  // Machine cost × quantity (each unit needs its own print time)
  const machineCostCents = Math.round((printTimePerUnit / 60) * cfg.machineRatePerHourCents) * input.quantity;

  // Setup fee is once per line item regardless of quantity
  const setupFeeCents = cfg.setupFeeCents;

  // Raw total for this line
  const rawTotal = materialCostCents + machineCostCents + setupFeeCents;

  // Minimum applies to the whole line (not per unit), so qty still scales correctly
  const itemTotalCents = Math.max(rawTotal, cfg.minimumLineCents);

  return {
    filename,
    material: input.material,
    colour: input.colour,
    quantity: input.quantity,
    solidVolumeCm3: parseFloat(solidVolumeCm3.toFixed(2)),
    printedVolumeCm3: parseFloat(printedVolumeCm3.toFixed(2)),
    estimatedWeightGrams: weightPerUnitGrams,
    estimatedPrintTimeMinutes: printTimePerUnit,
    materialCostCents,
    machineCostCents,
    setupFeeCents,
    itemTotalCents,
  };
}

export function sumQuote(items: ItemQuoteResult[]): QuoteResult {
  const subtotalCents = items.reduce((s, i) => s + i.itemTotalCents, 0);
  const shippingCents = 1500;
  const gstCents = Math.round(subtotalCents * 0.1);
  const totalCents = subtotalCents + gstCents + shippingCents;
  return { items, subtotalCents, shippingCents, gstCents, totalCents };
}
