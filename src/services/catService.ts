// Cat CRUD service. Cats are never permanently deleted — they are archived
// (isActive = false) so historical records remain intact.

import { db } from '../db/database';
import type { Cat, IDate } from '../domain/types';
import { validateCat } from '../domain/validation';
import { newId } from './id';

export interface CatInput {
  name: string;
  dateOfBirth: IDate | null;
  weightKg: number | null;
  photo: Cat['photo'];
}

function now(): string {
  return new Date().toISOString();
}

export async function createCat(input: CatInput): Promise<Cat> {
  const cat: Cat = {
    id: newId(),
    name: input.name.trim(),
    dateOfBirth: input.dateOfBirth,
    weightKg: input.weightKg,
    photo: input.photo,
    isActive: true,
    isDemo: false,
    createdAt: now(),
    updatedAt: now(),
  };
  const problems = validateCat(cat);
  if (problems.length > 0) throw new Error(problems.join('; '));
  await db.cats.add(cat);
  return cat;
}

export async function updateCat(id: string, input: CatInput): Promise<Cat> {
  const existing = await db.cats.get(id);
  if (!existing) throw new Error(`Cat not found: ${id}`);
  const updated: Cat = {
    ...existing,
    name: input.name.trim(),
    dateOfBirth: input.dateOfBirth,
    weightKg: input.weightKg,
    photo: input.photo,
    updatedAt: now(),
  };
  const problems = validateCat(updated);
  if (problems.length > 0) throw new Error(problems.join('; '));
  await db.cats.put(updated);
  return updated;
}

export async function setCatActive(id: string, isActive: boolean): Promise<void> {
  const existing = await db.cats.get(id);
  if (!existing) throw new Error(`Cat not found: ${id}`);
  await db.cats.put({ ...existing, isActive, updatedAt: now() });
}

export async function archiveCat(id: string): Promise<void> {
  await setCatActive(id, false);
}

export async function reactivateCat(id: string): Promise<void> {
  await setCatActive(id, true);
}

export async function getActiveCats(): Promise<Cat[]> {
  return db.cats.filter((c) => c.isActive).sortBy('name');
}

export async function getAllCats(): Promise<Cat[]> {
  return db.cats.orderBy('name').toArray();
}