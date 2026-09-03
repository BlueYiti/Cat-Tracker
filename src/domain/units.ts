import type { CountUnitCode, UnitCode, UnitKind, WeightUnitCode } from './types';

export const GRAMS_PER_KG = 1000;

export const WEIGHT_UNITS: WeightUnitCode[] = ['g', 'kg'];
export const COUNT_UNITS: CountUnitCode[] = ['can', 'pouch', 'piece'];

export const UNIT_KIND_BY_CODE: Record<UnitCode, UnitKind> = {
  g: 'weight',
  kg: 'weight',
  can: 'count',
  pouch: 'count',
  piece: 'count',
};

export function isWeightUnit(unit: UnitCode): unit is WeightUnitCode {
  return unit === 'g' || unit === 'kg';
}

export function isCountUnit(unit: UnitCode): unit is CountUnitCode {
  return unit === 'can' || unit === 'pouch' || unit === 'piece';
}

/** Convert a weight quantity to grams. Only valid for weight units. */
export function toGrams(quantity: number, unit: WeightUnitCode): number {
  if (unit === 'kg') return quantity * GRAMS_PER_KG;
  return quantity;
}

/** Convert grams back to a user-friendly unit. Returns { value, unit }. */
export function formatWeight(grams: number): { value: number; unit: WeightUnitCode } {
  const safe = Number.isFinite(grams) && grams >= 0 ? grams : 0;
  if (safe >= GRAMS_PER_KG) return { value: round(safe / GRAMS_PER_KG), unit: 'kg' };
  return { value: round(safe), unit: 'g' };
}

function round(n: number): number {
  // Up to 2 decimals, strip trailing zeros.
  return Math.round(n * 100) / 100;
}

/** Display a quantity with its unit, e.g. `1.5 kg`, `500 g`, `3 cans`. */
export function formatQuantity(quantity: number, unit: UnitCode): string {
  const safe = Number.isFinite(quantity) ? quantity : 0;
  if (isWeightUnit(unit)) {
    // Keep small weights in grams, larger in kg for readability.
    const { value, unit: u } = formatWeight(toGrams(safe, unit));
    return `${formatNumber(value)} ${u}`;
  }
  return `${formatNumber(safe)} ${unit}s`;
}

function formatNumber(n: number): string {
  const rounded = round(n);
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

/** Total quantity of multiple supplies, normalized to a common unit. */
export function sumQuantities(quantities: { value: number; unit: UnitCode }[]): {
  value: number;
  unit: UnitCode;
} | null {
  const first = quantities[0];
  if (!first) return null;
  const kind = UNIT_KIND_BY_CODE[first.unit];
  if (quantities.some((q) => UNIT_KIND_BY_CODE[q.unit] !== kind)) return null; // never mix kinds
  if (kind === 'weight') {
    const totalGrams = quantities.reduce((acc, q) => acc + toGrams(q.value, q.unit as WeightUnitCode), 0);
    const f = formatWeight(totalGrams);
    return { value: f.value, unit: f.unit };
  }
  const total = quantities.reduce((acc, q) => acc + q.value, 0);
  return { value: total, unit: first.unit as CountUnitCode };
}

/** Human label for a unit code. */
export function unitLabel(unit: UnitCode): string {
  switch (unit) {
    case 'g':
      return 'gram(s)';
    case 'kg':
      return 'kilogram(s)';
    case 'can':
      return 'can(s)';
    case 'pouch':
      return 'pouch(es)';
    case 'piece':
      return 'piece(s)';
  }
}