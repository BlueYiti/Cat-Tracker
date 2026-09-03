// Product service. Products referenced by supplies can never be deleted —
// they are archived (isActive = false) instead, preserving history.

import { db } from '../db/database';
import type { FoodType, Product, ProductCategory, UnitCode, UnitKind } from '../domain/types';
import { validateProduct } from '../domain/validation';
import { newId } from './id';

export interface ProductInput {
  category: ProductCategory;
  brand: string;
  name: string;
  foodType: FoodType | null;
  unitKind: UnitKind;
  defaultUnit: UnitCode;
}

function now(): string {
  return new Date().toISOString();
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const product: Product = {
    id: newId(),
    category: input.category,
    brand: input.brand.trim(),
    name: input.name.trim(),
    foodType: input.category === 'food' ? input.foodType : null,
    unitKind: input.unitKind,
    defaultUnit: input.defaultUnit,
    isActive: true,
    isDemo: false,
    createdAt: now(),
    updatedAt: now(),
  };
  const problems = validateProduct(product);
  if (problems.length > 0) throw new Error(problems.join('; '));
  await db.products.add(product);
  return product;
}

export async function updateProduct(id: string, input: ProductInput): Promise<Product> {
  const existing = await db.products.get(id);
  if (!existing) throw new Error(`Product not found: ${id}`);
  const updated: Product = {
    ...existing,
    category: input.category,
    brand: input.brand.trim(),
    name: input.name.trim(),
    foodType: input.category === 'food' ? input.foodType : null,
    unitKind: input.unitKind,
    defaultUnit: input.defaultUnit,
    updatedAt: now(),
  };
  const problems = validateProduct(updated);
  if (problems.length > 0) throw new Error(problems.join('; '));
  await db.products.put(updated);
  return updated;
}

/** Archive a product. If it has supplies, it cannot be deleted — archive instead. */
export async function archiveProduct(id: string): Promise<void> {
  const existing = await db.products.get(id);
  if (!existing) throw new Error(`Product not found: ${id}`);
  await db.products.put({ ...existing, isActive: false, updatedAt: now() });
}

export async function reactivateProduct(id: string): Promise<void> {
  const existing = await db.products.get(id);
  if (!existing) throw new Error(`Product not found: ${id}`);
  await db.products.put({ ...existing, isActive: true, updatedAt: now() });
}

/**
 * Attempt to delete a product. Throws if any supply references it.
 * Returns true if deleted, false if it was archived instead.
 */
export async function deleteProduct(id: string): Promise<boolean> {
  const existing = await db.products.get(id);
  if (!existing) throw new Error(`Product not found: ${id}`);

  const supplyCount = await db.supplies.where('productId').equals(id).count();
  if (supplyCount > 0) {
    await archiveProduct(id);
    return false;
  }
  await db.products.delete(id);
  return true;
}

export async function getActiveProducts(category?: ProductCategory): Promise<Product[]> {
  let collection = db.products.filter((p) => p.isActive);
  if (category) {
    collection = collection.filter((p) => p.category === category);
  }
  return collection.sortBy('brand');
}

export async function getAllProducts(): Promise<Product[]> {
  return db.products.orderBy('brand').toArray();
}

export async function getProduct(id: string): Promise<Product | undefined> {
  return db.products.get(id);
}