import { describe, expect, it } from 'vitest';
import {
  formatQuantity,
  formatWeight,
  isCountUnit,
  isWeightUnit,
  sumQuantities,
  toGrams,
  unitLabel,
  WEIGHT_UNITS,
  COUNT_UNITS,
  GRAMS_PER_KG,
} from './units';

describe('isWeightUnit / isCountUnit', () => {
  it('correctly identifies weight units', () => {
    expect(isWeightUnit('g')).toBe(true);
    expect(isWeightUnit('kg')).toBe(true);
    expect(isWeightUnit('can')).toBe(false);
  });

  it('correctly identifies count units', () => {
    expect(isCountUnit('can')).toBe(true);
    expect(isCountUnit('pouch')).toBe(true);
    expect(isCountUnit('piece')).toBe(true);
    expect(isCountUnit('kg')).toBe(false);
  });
});

describe('WEIGHT_UNITS / COUNT_UNITS', () => {
  it('exports the correct unit lists', () => {
    expect(WEIGHT_UNITS).toEqual(['g', 'kg']);
    expect(COUNT_UNITS).toEqual(['can', 'pouch', 'piece']);
  });
});

describe('GRAMS_PER_KG', () => {
  it('is 1000', () => {
    expect(GRAMS_PER_KG).toBe(1000);
  });
});

describe('toGrams', () => {
  it('converts kg to grams', () => {
    expect(toGrams(1, 'kg')).toBe(1000);
    expect(toGrams(1.5, 'kg')).toBe(1500);
  });

  it('passes through grams unchanged', () => {
    expect(toGrams(500, 'g')).toBe(500);
  });
});

describe('formatWeight', () => {
  it('uses grams for small weights', () => {
    expect(formatWeight(500)).toEqual({ value: 500, unit: 'g' });
    expect(formatWeight(999)).toEqual({ value: 999, unit: 'g' });
  });

  it('uses kg for large weights', () => {
    expect(formatWeight(1000)).toEqual({ value: 1, unit: 'kg' });
    expect(formatWeight(2500)).toEqual({ value: 2.5, unit: 'kg' });
  });

  it('rounds to 2 decimal places', () => {
    expect(formatWeight(1550)).toEqual({ value: 1.55, unit: 'kg' });
    expect(formatWeight(1234)).toEqual({ value: 1.23, unit: 'kg' });
  });

  it('returns 0 g for NaN or negative input', () => {
    expect(formatWeight(NaN)).toEqual({ value: 0, unit: 'g' });
    expect(formatWeight(-100)).toEqual({ value: 0, unit: 'g' });
    expect(formatWeight(Infinity)).toEqual({ value: 0, unit: 'g' });
  });
});

describe('formatQuantity', () => {
  it('formats weight in grams', () => {
    expect(formatQuantity(500, 'g')).toBe('500 g');
    expect(formatQuantity(999, 'g')).toBe('999 g');
  });

  it('formats weight in kg for large amounts', () => {
    expect(formatQuantity(1, 'kg')).toBe('1 kg');
    expect(formatQuantity(1.5, 'kg')).toBe('1.5 kg');
    expect(formatQuantity(2.5, 'kg')).toBe('2.5 kg');
  });

  it('converts kg to grams for small amounts', () => {
    // 0.5 kg = 500g → displayed in grams
    expect(formatQuantity(0.5, 'kg')).toBe('500 g');
  });

  it('formats count units by appending s', () => {
    expect(formatQuantity(3, 'can')).toBe('3 cans');
    expect(formatQuantity(5, 'pouch')).toBe('5 pouchs');
    expect(formatQuantity(1, 'piece')).toBe('1 pieces');
  });

  it('handles NaN input gracefully', () => {
    expect(formatQuantity(NaN, 'kg')).toBe('0 g');
  });

  it('handles Infinity input gracefully', () => {
    expect(formatQuantity(Infinity, 'g')).toBe('0 g');
  });
});

describe('sumQuantities', () => {
  it('returns null for empty array', () => {
    expect(sumQuantities([])).toBeNull();
  });

  it('sums same-kind weight units (normalizes to grams/kg)', () => {
    const result = sumQuantities([
      { value: 1, unit: 'kg' },
      { value: 500, unit: 'g' },
    ]);
    // 1000 + 500 = 1500g → 1.5 kg
    expect(result).toEqual({ value: 1.5, unit: 'kg' });
  });

  it('keeps small totals in grams', () => {
    const result = sumQuantities([
      { value: 300, unit: 'g' },
      { value: 400, unit: 'g' },
    ]);
    expect(result).toEqual({ value: 700, unit: 'g' });
  });

  it('sums count units', () => {
    const result = sumQuantities([
      { value: 3, unit: 'can' },
      { value: 2, unit: 'can' },
    ]);
    expect(result).toEqual({ value: 5, unit: 'can' });
  });

  it('returns null when mixing weight and count units', () => {
    expect(
      sumQuantities([
        { value: 1, unit: 'kg' },
        { value: 2, unit: 'can' },
      ]),
    ).toBeNull();
  });

  it('handles a single quantity', () => {
    expect(sumQuantities([{ value: 2, unit: 'kg' }])).toEqual({ value: 2, unit: 'kg' });
  });
});

describe('unitLabel', () => {
  it('returns human-readable labels', () => {
    expect(unitLabel('g')).toBe('gram(s)');
    expect(unitLabel('kg')).toBe('kilogram(s)');
    expect(unitLabel('can')).toBe('can(s)');
    expect(unitLabel('pouch')).toBe('pouch(es)');
    expect(unitLabel('piece')).toBe('piece(s)');
  });

  it('exhausts all unit codes', () => {
    const allUnits = [...WEIGHT_UNITS, ...COUNT_UNITS] as const;
    allUnits.forEach((u) => {
      expect(unitLabel(u)).toBeTruthy();
    });
  });
});
