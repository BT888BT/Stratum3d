import type { QuoteInputParsed } from "@/lib/validation";

/**
 * Pricing model (Bambu Lab FDM — X1C / P1S / P1P):
 *
 * ── Material volume ────────────────────────────────────────────────────────────
 *   Shell volume  = surfaceAreaMm2 × shellThicknessMm / 1000          → cm³
 *                   shellThickness = WALL_COUNT(2) × LINE_WIDTH(0.4mm) = 0.8 mm
 *                   (covers outer walls + top/bottom solid layers, which together
 *                    sit on every exterior surface)
 *   Infill volume = max(0, solidVolume − shellVolume) × (infillPercent / 100)
 *   Printed vol   = (shellVolume + infillVolume) × supportFactor
 *   Weight/unit   = printedVolume × materialDensity
 *
 * ── Print time (Bambu effective flow, 0.2 mm baseline) ────────────────────────
 *   Shell time    = shellVolumeMm3  / (SHELL_FLOW  × layerScale)
 *   Infill time   = infillVolumeMm3 / (INFILL_FLOW × layerScale)
 *   Layer overhead= (heightMm / layerHeight) × 3 s   (Z-hop, wipe, next-layer travel)
 *   Startup       = 3 min fixed   (AMS init, bed levelling, first-layer caution)
 *   layerScale    = layerHeightMm / 0.2  (thicker layer → more volume per mm travel)
 *   SHELL_FLOW    = 11 mm³/s  (effective — outer wall ~200 mm/s, 0.4 mm nozzle, accel)
 *   INFILL_FLOW   = 20 mm³/s  (effective — infill ~350 mm/s, wider passes)
 *
 * ── Costs ──────────────────────────────────────────────────────────────────────
 *   Material cost      = weight × filament ¢/g × quantity
 *   Machine cost       = printTime × machine ¢/hr × quantity
 *   Setup fee          = per line item (not per unit)
 *   Support removal    = +20% on (material + machine)
 *   Height surcharge   = 0/5/10/15% on (material+machine)  for ≤50/≤100/≤200/>200 mm
 *   SA surcharge       = 0/5/10/15% on material cost        for ≤100/≤300/≤600/>600 cm²
 *   Minimum per item
 *   GST 10%, shipping $15 AUD or $2.50 pickup
 *   PRICE_MULTIPLIER env var scales the final item total
 */

// ── Bambu Lab print parameters ────────────────────────────────────────────────
const WALL_COUNT       = 2;    // standard Bambu default (outer + 1 inner)
const LINE_WIDTH_MM    = 0.4;  // 0.4 mm nozzle
const SHELL_THICK_MM   = WALL_COUNT * LINE_WIDTH_MM; // 0.8 mm

const SHELL_FLOW_MM3_PER_SEC  = 11; // effective shell  flow at 0.2 mm layer height
const INFILL_FLOW_MM3_PER_SEC = 20; // effective infill flow at 0.2 mm layer height
const STARTUP_SECONDS         = 3 * 60; // bed levelling + warmup
const LAYER_OVERHEAD_SECONDS  = 3;     // per layer: Z-hop + wipe tower + travel

// ── Material config ───────────────────────────────────────────────────────────
type MaterialConfig = {
  densityGPerCm3: number;
  filamentCostPerGramCents: number;
  machineRatePerHourCents: number;
  setupFeeCents: number;
  minimumLineCents: number;
};

const MINIMUM_LINE_CENTS       = parseInt(process.env.MINIMUM_LINE_CENTS ?? "100");
const MACHINE_RATE_PER_HOUR_CENTS = 200; // $2.00/hr

const MATERIALS: Record<string, MaterialConfig> = {
  PLA:  { densityGPerCm3: 1.24, filamentCostPerGramCents: 4, machineRatePerHourCents: MACHINE_RATE_PER_HOUR_CENTS, setupFeeCents: 200, minimumLineCents: MINIMUM_LINE_CENTS },
  PETG: { densityGPerCm3: 1.27, filamentCostPerGramCents: 4, machineRatePerHourCents: MACHINE_RATE_PER_HOUR_CENTS, setupFeeCents: 200, minimumLineCents: MINIMUM_LINE_CENTS },
  ABS:  { densityGPerCm3: 1.04, filamentCostPerGramCents: 5, machineRatePerHourCents: MACHINE_RATE_PER_HOUR_CENTS, setupFeeCents: 200, minimumLineCents: MINIMUM_LINE_CENTS },
};

// ── Volume calculation ────────────────────────────────────────────────────────
function calcPrintedVolumeCm3(
  solidVolumeCm3: number,
  surfaceAreaMm2: number,
  infillPercent: number,
  removeSupports: boolean
): { shellVolumeCm3: number; infillVolumeCm3: number; printedVolumeCm3: number } {
  let shellVolumeCm3: number;
  let infillVolumeCm3: number;

  if (surfaceAreaMm2 > 0) {
    // Shell wraps every exterior surface — walls, top, bottom
    shellVolumeCm3  = (surfaceAreaMm2 * SHELL_THICK_MM) / 1000;
    // Infill fills only the interior space that isn't already shell
    const interiorCm3 = Math.max(0, solidVolumeCm3 - shellVolumeCm3);
    infillVolumeCm3   = interiorCm3 * (infillPercent / 100);
  } else {
    // Fallback for formats where SA isn't calculated (OBJ / 3MF)
    shellVolumeCm3  = solidVolumeCm3 * 0.3; // rough 30% shell estimate
    infillVolumeCm3 = Math.max(0, solidVolumeCm3 - shellVolumeCm3) * (infillPercent / 100);
  }

  const base = shellVolumeCm3 + infillVolumeCm3;
  const supportFactor = removeSupports ? 1.20 : 1.0;
  const printedVolumeCm3 = Math.max(0.1, base * supportFactor);

  return { shellVolumeCm3, infillVolumeCm3, printedVolumeCm3 };
}

// ── Print time estimate (Bambu X1C / P1S) ────────────────────────────────────
function estimatePrintTimeMinutes(
  shellVolumeCm3: number,
  infillVolumeCm3: number,
  layerHeightMm: number,
  heightMm: number
): number {
  const layerScale      = layerHeightMm / 0.2;
  const shellFlowRate   = SHELL_FLOW_MM3_PER_SEC  * layerScale;
  const infillFlowRate  = INFILL_FLOW_MM3_PER_SEC * layerScale;

  const shellSec  = (shellVolumeCm3  * 1000) / shellFlowRate;
  const infillSec = (infillVolumeCm3 * 1000) / infillFlowRate;

  const layerCount         = heightMm > 0 ? Math.ceil(heightMm / layerHeightMm) : 0;
  const layerOverheadSec   = layerCount * LAYER_OVERHEAD_SECONDS;

  const totalSec = STARTUP_SECONDS + shellSec + infillSec + layerOverheadSec;
  return Math.max(5, Math.round(totalSec / 60));
}

// ── Surcharge helpers ─────────────────────────────────────────────────────────
/**
 * Height surcharge (applied to material + machine costs):
 *   ≤ 50 mm  → 0%   51–100 mm → 5%   101–200 mm → 10%   > 200 mm → 15%
 */
function heightSurchargeFactor(heightMm: number): number {
  if (heightMm <= 50)  return 0;
  if (heightMm <= 100) return 0.05;
  if (heightMm <= 200) return 0.10;
  return 0.15;
}

/**
 * Surface area surcharge (applied to material cost — SA drives outer-wall filament use):
 *   ≤ 100 cm² → 0%   101–300 cm² → 5%   301–600 cm² → 10%   > 600 cm² → 15%
 */
function surfaceAreaSurchargeFactor(surfaceAreaMm2: number): number {
  const cm2 = surfaceAreaMm2 / 100;
  if (cm2 <= 100) return 0;
  if (cm2 <= 300) return 0.05;
  if (cm2 <= 600) return 0.10;
  return 0.15;
}

// ── Public types ──────────────────────────────────────────────────────────────
export type ItemQuoteResult = {
  filename: string;
  material: string;
  colour: string;
  quantity: number;
  removeSupports: boolean;
  solidVolumeCm3: number;
  shellVolumeCm3: number;
  infillVolumeCm3: number;
  printedVolumeCm3: number;
  estimatedWeightGrams: number;
  estimatedPrintTimeMinutes: number;
  materialCostCents: number;
  machineCostCents: number;
  setupFeeCents: number;
  supportRemovalCents: number;
  heightSurchargeCents: number;
  surfaceAreaSurchargeCents: number;
  itemTotalCents: number;
};

export type QuoteResult = {
  items: ItemQuoteResult[];
  subtotalCents: number;
  shippingCents: number;
  gstCents: number;
  totalCents: number;
};

// ── Main item quote ───────────────────────────────────────────────────────────
export function calculateItemQuote(
  input: QuoteInputParsed,
  volumeMm3: number,
  filename: string,
  heightMm = 0,
  surfaceAreaMm2 = 0
): ItemQuoteResult {
  const cfg = MATERIALS[input.material] ?? MATERIALS.PLA;

  const solidVolumeCm3 = volumeMm3 / 1000;

  const { shellVolumeCm3, infillVolumeCm3, printedVolumeCm3 } = calcPrintedVolumeCm3(
    solidVolumeCm3,
    surfaceAreaMm2,
    input.infillPercent,
    input.removeSupports
  );

  const weightPerUnitGrams = parseFloat((printedVolumeCm3 * cfg.densityGPerCm3).toFixed(1));

  const materialCostCents = Math.round(weightPerUnitGrams * cfg.filamentCostPerGramCents) * input.quantity;

  const printTimePerUnit = estimatePrintTimeMinutes(
    shellVolumeCm3,
    infillVolumeCm3,
    input.layerHeightMm,
    heightMm
  );

  const machineCostCents = Math.round((printTimePerUnit / 60) * cfg.machineRatePerHourCents) * input.quantity;

  const setupFeeCents = cfg.setupFeeCents;

  // Support removal: +20% on material + machine
  const supportRemovalCents = input.removeSupports
    ? Math.round((materialCostCents + machineCostCents) * 0.20)
    : 0;

  // Height surcharge: tall prints take more layers → more time risk
  const heightSurchargeCents = Math.round(
    (materialCostCents + machineCostCents) * heightSurchargeFactor(heightMm)
  );

  // Surface area surcharge: high SA → more perimeter passes → more material
  const surfaceAreaSurchargeCents = Math.round(
    materialCostCents * surfaceAreaSurchargeFactor(surfaceAreaMm2)
  );

  const rawTotal =
    materialCostCents +
    machineCostCents +
    setupFeeCents +
    supportRemovalCents +
    heightSurchargeCents +
    surfaceAreaSurchargeCents;

  const priceMultiplier = parseFloat(process.env.PRICE_MULTIPLIER ?? "1");
  const itemTotalCents = Math.max(Math.round(rawTotal * priceMultiplier), cfg.minimumLineCents);

  return {
    filename,
    material: input.material,
    colour: input.colour,
    quantity: input.quantity,
    removeSupports: input.removeSupports,
    solidVolumeCm3: parseFloat(solidVolumeCm3.toFixed(3)),
    shellVolumeCm3: parseFloat(shellVolumeCm3.toFixed(3)),
    infillVolumeCm3: parseFloat(infillVolumeCm3.toFixed(3)),
    printedVolumeCm3: parseFloat(printedVolumeCm3.toFixed(3)),
    estimatedWeightGrams: weightPerUnitGrams,
    estimatedPrintTimeMinutes: printTimePerUnit,
    materialCostCents,
    machineCostCents,
    setupFeeCents,
    supportRemovalCents,
    heightSurchargeCents,
    surfaceAreaSurchargeCents,
    itemTotalCents,
  };
}

export function sumQuote(items: ItemQuoteResult[], shippingMethod: string): QuoteResult {
  const subtotalCents = items.reduce((s, i) => s + i.itemTotalCents, 0);
  const shippingCents = shippingMethod === "pickup" ? 250 : 1500;
  const gstCents      = Math.round((subtotalCents + shippingCents) * 0.1);
  const totalCents    = subtotalCents + shippingCents + gstCents;
  return { items, subtotalCents, shippingCents, gstCents, totalCents };
}
