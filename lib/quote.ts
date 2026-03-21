import type { QuoteInputParsed } from "@/lib/validation";

/**
 * Pricing is based on real FDM print cost modelling:
 *
 * 1. Volume estimation:
 *    - Bounding box * infill fraction * 0.35 (typical wall/infill ratio)
 *    - Minimum 0.5 cm³ to avoid zero-cost tiny parts
 *
 * 2. Material cost:
 *    - Filament density (g/cm³) → grams used → cost per gram
 *    - PLA: 1.24 g/cm³, PETG: 1.27 g/cm³, ABS: 1.04 g/cm³
 *
 * 3. Machine time cost:
 *    - Layer height + infill affect speed
 *    - Base rate: $2.00 AUD/hr for machine wear + electricity
 *
 * 4. Setup fee per job (slicing, quality check)
 *
 * 5. Minimum order enforced
 *
 * 6. GST 10%, optional standard shipping $15 AUD
 */

type MaterialConfig = {
  densityGPerCm3: number;        // filament density
  filamentCostPerGramCents: number; // AUD cents per gram of filament
  machineRatePerHourCents: number;  // AUD cents per machine-hour
  setupFeeCents: number;
  minimumOrderCents: number;
};

const MATERIALS: Record<QuoteInputParsed["material"], MaterialConfig> = {
  PLA: {
    densityGPerCm3: 1.24,
    filamentCostPerGramCents: 4,   // ~$4/100g spool typical retail
    machineRatePerHourCents: 200,  // $2/hr machine wear + electricity
    setupFeeCents: 500,            // $5 per job setup
    minimumOrderCents: 1500        // $15 minimum
  },
  PETG: {
    densityGPerCm3: 1.27,
    filamentCostPerGramCents: 5,
    machineRatePerHourCents: 220,
    setupFeeCents: 600,
    minimumOrderCents: 1800
  },
  ABS: {
    densityGPerCm3: 1.04,
    filamentCostPerGramCents: 5,
    machineRatePerHourCents: 250,
    setupFeeCents: 700,
    minimumOrderCents: 2000
  }
};

// Print speed model: base mm³/s varies by layer height and infill
// Typical 0.4mm nozzle at 60mm/s perimeter, 80mm/s infill
function estimatePrintTimeMinutes(
  volumeCm3: number,
  layerHeightMm: number,
  infillPercent: number
): number {
  const volumeMm3 = volumeCm3 * 1000;

  // Higher layer height = faster (more material per move)
  // Lower infill = faster (less travel)
  const baseSpeedMm3PerSec = 8; // conservative base
  const layerFactor = layerHeightMm / 0.2; // normalised to 0.2mm
  const infillFactor = 0.5 + (infillPercent / 100) * 0.5; // 0.5–1.0

  const effectiveSpeed = baseSpeedMm3PerSec * layerFactor / infillFactor;
  const printSeconds = volumeMm3 / effectiveSpeed;

  // Add 20% overhead for travel moves, retracts, layer changes
  const totalSeconds = printSeconds * 1.2;
  return Math.max(15, Math.round(totalSeconds / 60));
}

export type QuoteResult = {
  estimatedVolumeCm3: number;
  estimatedWeightGrams: number;
  estimatedPrintTimeMinutes: number;
  materialCostCents: number;
  machineCostCents: number;
  setupFeeCents: number;
  subtotalCents: number;
  shippingCents: number;
  gstCents: number;
  totalCents: number;
};

export function calculateQuote(input: QuoteInputParsed): QuoteResult {
  const cfg = MATERIALS[input.material];

  // Estimated solid volume: bounding box × infill fraction × shell ratio
  // Shell ratio 0.35 accounts for walls taking up ~35% of bounding volume
  const boundingBoxCm3 = (input.approxXmm * input.approxYmm * input.approxZmm) / 1000;
  const infillFraction = input.infillPercent / 100;
  const shellRatio = 0.30; // perimeter shells always present regardless of infill

  // Effective volume = shell volume (always) + infill volume
  const shellVolume = boundingBoxCm3 * shellRatio;
  const infillVolume = boundingBoxCm3 * (1 - shellRatio) * infillFraction;
  const estimatedVolumeCm3 = Math.max(0.5, shellVolume + infillVolume);

  // Weight
  const estimatedWeightGrams = parseFloat((estimatedVolumeCm3 * cfg.densityGPerCm3).toFixed(1));

  // Material cost
  const materialCostCents = Math.round(estimatedWeightGrams * cfg.filamentCostPerGramCents) * input.quantity;

  // Machine time
  const estimatedPrintTimeMinutes = estimatePrintTimeMinutes(
    estimatedVolumeCm3,
    input.layerHeightMm,
    input.infillPercent
  );
  const machineHours = estimatedPrintTimeMinutes / 60;
  const machineCostCents = Math.round(machineHours * cfg.machineRatePerHourCents) * input.quantity;

  // Subtotal before minimums
  const rawSubtotal = materialCostCents + machineCostCents + cfg.setupFeeCents;
  const subtotalCents = Math.max(rawSubtotal, cfg.minimumOrderCents);

  const shippingCents = input.shippingMethod === "pickup" ? 0 : 1500;
  const gstCents = Math.round(subtotalCents * 0.1);
  const totalCents = subtotalCents + gstCents + shippingCents;

  return {
    estimatedVolumeCm3: parseFloat(estimatedVolumeCm3.toFixed(2)),
    estimatedWeightGrams,
    estimatedPrintTimeMinutes,
    materialCostCents,
    machineCostCents,
    setupFeeCents: cfg.setupFeeCents,
    subtotalCents,
    shippingCents,
    gstCents,
    totalCents
  };
}
