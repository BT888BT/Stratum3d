import type { QuoteInputParsed } from "@/lib/validation";

/**
 * Pricing model (Bambu Lab FDM — X1C / P1S / P1P):
 *
 * ── Model material ─────────────────────────────────────────────────────────────
 *   Shell volume   = surfaceAreaMm2 × shellThicknessMm / 1000          → cm³
 *                    shellThickness = WALL_COUNT(2) × LINE_WIDTH(0.4mm) = 0.8 mm
 *   Infill volume  = max(0, solidVolume − shellVolume) × (infillPercent / 100)
 *   Model volume   = shellVolume + infillVolume
 *
 * ── Support material (always present in FDM) ───────────────────────────────────
 *   Support volume = modelVolume × SUPPORT_FRACTION (10%)
 *                    (Bambu tree supports at ~15% density covering ~65% of overhangs)
 *
 * ── Total printed volume / weight ──────────────────────────────────────────────
 *   Total volume   = modelVolume + supportVolume
 *   Weight/unit    = totalVolume × materialDensity
 *
 * ── Print time (Bambu effective flow, 0.2 mm baseline) ────────────────────────
 *   Shell time     = shellVolumeMm3  / (SHELL_FLOW  × layerScale)
 *   Infill time    = infillVolumeMm3 / (INFILL_FLOW × layerScale)
 *   Support time   = supportVolumeMm3 / (INFILL_FLOW × layerScale)
 *   Layer overhead = (heightMm / layerHeight) × 3 s
 *   Startup        = 3 min fixed
 *   layerScale     = layerHeightMm / 0.2
 *   SHELL_FLOW     = 11 mm³/s  (effective outer wall)
 *   INFILL_FLOW    = 20 mm³/s  (effective infill / support)
 *
 * ── Costs ──────────────────────────────────────────────────────────────────────
 *   Material cost      = totalWeight × filament ¢/g × quantity
 *   Machine cost       = totalPrintTime × machine ¢/hr × quantity
 *   Setup fee          = per line item (not per unit)
 *   Support removal    = +20% on (material + machine)  [labour to remove supports]
 *   Height surcharge   = 0/5/10/15% on (material+machine)  ≤50/≤100/≤200/>200 mm
 *   SA surcharge       = 0/5/10/15% on material cost        ≤100/≤300/≤600/>600 cm²
 *   Minimum per item
 *   GST 10%, shipping $15 AUD or $2.50 pickup
 *   PRICE_MULTIPLIER env var scales the final item total
 *
 * ── Customer display time ──────────────────────────────────────────────────────
 *   displayPrintTimeMinutes = sum(itemTime × qty) × 1.30 buffer, rounded up to 5 min
 */

// ── Bambu Lab print parameters ────────────────────────────────────────────────
const WALL_COUNT      = 2;    // outer + 1 inner wall (Bambu default)
const LINE_WIDTH_MM   = 0.4;  // 0.4 mm nozzle
const SHELL_THICK_MM  = WALL_COUNT * LINE_WIDTH_MM; // 0.8 mm

const SHELL_FLOW_MM3_PER_SEC  = 7.7; // effective shell  flow at 0.2 mm layer height (11 × 0.70)
const INFILL_FLOW_MM3_PER_SEC = 14;  // effective infill / support flow at 0.2 mm layer height (20 × 0.70)
const STARTUP_SECONDS         = 3 * 60; // AMS init + bed levelling + first-layer caution
const LAYER_OVERHEAD_SECONDS  = 3;      // per layer: Z-hop + wipe + next-layer travel

// Support estimate: ~10% of model printed volume
// (Bambu tree supports at ~15% density on typical overhangs)
const SUPPORT_FRACTION = 0.10;

// Customer-facing time buffer (30%) to account for first-layer retries, pauses, etc.
const DISPLAY_TIME_BUFFER = 1.30;

// ── Material config ───────────────────────────────────────────────────────────
type MaterialConfig = {
  densityGPerCm3: number;
  filamentCostPerGramCents: number;
  machineRatePerHourCents: number;
  setupFeeCents: number;
  minimumLineCents: number;
};

const MINIMUM_LINE_CENTS          = parseInt(process.env.MINIMUM_LINE_CENTS ?? "100");
const MACHINE_RATE_PER_HOUR_CENTS = 200; // $2.00/hr

const MATERIALS: Record<string, MaterialConfig> = {
  PLA:  { densityGPerCm3: 1.24, filamentCostPerGramCents: 4, machineRatePerHourCents: MACHINE_RATE_PER_HOUR_CENTS, setupFeeCents: 200, minimumLineCents: MINIMUM_LINE_CENTS },
  PETG: { densityGPerCm3: 1.27, filamentCostPerGramCents: 4, machineRatePerHourCents: MACHINE_RATE_PER_HOUR_CENTS, setupFeeCents: 200, minimumLineCents: MINIMUM_LINE_CENTS },
  ABS:  { densityGPerCm3: 1.04, filamentCostPerGramCents: 5, machineRatePerHourCents: MACHINE_RATE_PER_HOUR_CENTS, setupFeeCents: 200, minimumLineCents: MINIMUM_LINE_CENTS },
};

// ── Volume helpers ────────────────────────────────────────────────────────────
function calcModelVolumes(
  solidVolumeCm3: number,
  surfaceAreaMm2: number,
  infillPercent: number
): { shellVolumeCm3: number; infillVolumeCm3: number; modelVolumeCm3: number } {
  let shellVolumeCm3: number;
  let infillVolumeCm3: number;

  if (surfaceAreaMm2 > 0) {
    shellVolumeCm3 = (surfaceAreaMm2 * SHELL_THICK_MM) / 1000;
    const interiorCm3 = Math.max(0, solidVolumeCm3 - shellVolumeCm3);
    infillVolumeCm3 = interiorCm3 * (infillPercent / 100);
  } else {
    // Fallback for OBJ / 3MF where SA is not extracted
    shellVolumeCm3 = solidVolumeCm3 * 0.3;
    infillVolumeCm3 = Math.max(0, solidVolumeCm3 - shellVolumeCm3) * (infillPercent / 100);
  }

  const modelVolumeCm3 = Math.max(0.1, shellVolumeCm3 + infillVolumeCm3);
  return { shellVolumeCm3, infillVolumeCm3, modelVolumeCm3 };
}

function calcSupportVolumeCm3(modelVolumeCm3: number): number {
  return modelVolumeCm3 * SUPPORT_FRACTION;
}

// ── Print time helpers ────────────────────────────────────────────────────────
type PrintTimeBreakdown = {
  modelTimeMins: number;
  supportTimeMins: number;
  totalTimeMins: number;
};

function estimatePrintTime(
  shellVolumeCm3: number,
  infillVolumeCm3: number,
  supportVolumeCm3: number,
  layerHeightMm: number,
  heightMm: number
): PrintTimeBreakdown {
  const layerScale     = layerHeightMm / 0.2;
  const shellFlow      = SHELL_FLOW_MM3_PER_SEC  * layerScale;
  const infillFlow     = INFILL_FLOW_MM3_PER_SEC * layerScale;

  const shellSec       = (shellVolumeCm3   * 1000) / shellFlow;
  const infillSec      = (infillVolumeCm3  * 1000) / infillFlow;
  const supportSec     = (supportVolumeCm3 * 1000) / infillFlow; // supports at infill speed

  const layerCount         = heightMm > 0 ? Math.ceil(heightMm / layerHeightMm) : 0;
  const layerOverheadSec   = layerCount * LAYER_OVERHEAD_SECONDS;

  const modelTimeMins   = Math.max(0, Math.round((STARTUP_SECONDS + shellSec + infillSec + layerOverheadSec) / 60));
  const supportTimeMins = Math.max(0, Math.round(supportSec / 60));

  return {
    modelTimeMins,
    supportTimeMins,
    totalTimeMins: Math.max(5, modelTimeMins + supportTimeMins),
  };
}

// ── Surcharge helpers ─────────────────────────────────────────────────────────
/** ≤50mm → 0%  51–100mm → 5%  101–200mm → 10%  >200mm → 15% */
function heightSurchargeFactor(heightMm: number): number {
  if (heightMm <= 50)  return 0;
  if (heightMm <= 100) return 0.05;
  if (heightMm <= 200) return 0.10;
  return 0.15;
}

/** ≤100cm² → 0%  101–300cm² → 5%  301–600cm² → 10%  >600cm² → 15% */
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
  // Volume breakdown (per unit)
  solidVolumeCm3: number;
  shellVolumeCm3: number;
  infillVolumeCm3: number;
  modelVolumeCm3: number;
  supportVolumeCm3: number;
  totalPrintedVolumeCm3: number;
  // Weight (per unit)
  modelWeightGrams: number;
  supportWeightGrams: number;
  estimatedWeightGrams: number; // model + support total
  // Time (per unit)
  modelPrintTimeMinutes: number;
  supportPrintTimeMinutes: number;
  estimatedPrintTimeMinutes: number; // total (model + support), used for machine cost
  // Costs
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
  displayPrintTimeMinutes: number; // buffered total across all items × quantities, shown to customer
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

  const { shellVolumeCm3, infillVolumeCm3, modelVolumeCm3 } = calcModelVolumes(
    solidVolumeCm3,
    surfaceAreaMm2,
    input.infillPercent
  );

  const supportVolumeCm3    = calcSupportVolumeCm3(modelVolumeCm3);
  const totalPrintedVolumeCm3 = modelVolumeCm3 + supportVolumeCm3;

  // Weights
  const modelWeightGrams   = modelVolumeCm3   * cfg.densityGPerCm3;
  const supportWeightGrams = supportVolumeCm3 * cfg.densityGPerCm3;
  const totalWeightGrams   = parseFloat((modelWeightGrams + supportWeightGrams).toFixed(1));

  // Material cost on total weight (model + support material is consumed)
  const materialCostCents = Math.round(totalWeightGrams * cfg.filamentCostPerGramCents) * input.quantity;

  // Print time includes both model and support extrusion
  const timeBreakdown = estimatePrintTime(
    shellVolumeCm3,
    infillVolumeCm3,
    supportVolumeCm3,
    input.layerHeightMm,
    heightMm
  );

  const machineCostCents = Math.round(
    (timeBreakdown.totalTimeMins / 60) * cfg.machineRatePerHourCents
  ) * input.quantity;

  const setupFeeCents = cfg.setupFeeCents;

  // removeSupports = labour surcharge for post-processing (support removal by hand)
  const supportRemovalCents = input.removeSupports
    ? Math.round((materialCostCents + machineCostCents) * 0.20)
    : 0;

  const heightSurchargeCents = Math.round(
    (materialCostCents + machineCostCents) * heightSurchargeFactor(heightMm)
  );

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
  const itemTotalCents  = Math.max(Math.round(rawTotal * priceMultiplier), cfg.minimumLineCents);

  return {
    filename,
    material: input.material,
    colour: input.colour,
    quantity: input.quantity,
    removeSupports: input.removeSupports,
    solidVolumeCm3:         parseFloat(solidVolumeCm3.toFixed(3)),
    shellVolumeCm3:         parseFloat(shellVolumeCm3.toFixed(3)),
    infillVolumeCm3:        parseFloat(infillVolumeCm3.toFixed(3)),
    modelVolumeCm3:         parseFloat(modelVolumeCm3.toFixed(3)),
    supportVolumeCm3:       parseFloat(supportVolumeCm3.toFixed(3)),
    totalPrintedVolumeCm3:  parseFloat(totalPrintedVolumeCm3.toFixed(3)),
    modelWeightGrams:       parseFloat(modelWeightGrams.toFixed(1)),
    supportWeightGrams:     parseFloat(supportWeightGrams.toFixed(1)),
    estimatedWeightGrams:   totalWeightGrams,
    modelPrintTimeMinutes:  timeBreakdown.modelTimeMins,
    supportPrintTimeMinutes: timeBreakdown.supportTimeMins,
    estimatedPrintTimeMinutes: timeBreakdown.totalTimeMins,
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

  // Customer-facing time: sum all items × their quantities, then apply buffer
  // and round up to the nearest 5 minutes so it reads as a clean estimate
  const rawTotalMins = items.reduce((s, i) => s + i.estimatedPrintTimeMinutes * i.quantity, 0);
  const displayPrintTimeMinutes = Math.ceil((rawTotalMins * DISPLAY_TIME_BUFFER) / 5) * 5;

  return { items, subtotalCents, shippingCents, gstCents, totalCents, displayPrintTimeMinutes };
}
