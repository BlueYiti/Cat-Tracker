// Supply entry form: record a purchase for litter or food.
// Quick mobile entry with sensible defaults (dates default to today).

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { ProductCategory, Supply, UnitCode } from '../domain/types';
import { createProduct, getActiveProducts } from '../services/productService';
import { createSupply, updateSupply, type SupplyInput } from '../services/supplyService';
import { todayLocal } from '../domain/dates';
import { isWeightUnit, WEIGHT_UNITS, COUNT_UNITS } from '../domain/units';
import { Modal, FieldError } from './ui';

interface Props {
  category: ProductCategory;
  supply?: Supply; // when editing
  product?: { id: string; defaultUnit: UnitCode } | undefined; // pre-selected product
  onClose: () => void;
  onSaved?: () => void;
}

export function SupplyForm({ category, supply, product, onClose, onSaved }: Props) {
  const products = useLiveQuery(() => getActiveProducts(category), [category]) ?? [];

  const [productId, setProductId] = useState(product?.id ?? supply?.productId ?? '');
  const [brand, setBrand] = useState('');
  const [productName, setProductName] = useState('');
  const [foodType, setFoodType] = useState<'dry' | 'wet' | 'treat' | 'other'>('dry');
  const [unitKind, setUnitKind] = useState<'weight' | 'count'>('weight');
  const [unit, setUnit] = useState<UnitCode>(product?.defaultUnit ?? supply?.unit ?? 'kg');
  const [createNewProduct, setCreateNewProduct] = useState(!product && !supply && products.length === 0);

  const [quantity, setQuantity] = useState(supply ? String(supply.quantity) : '');
  const [price, setPrice] = useState(supply ? String(supply.price) : '');
  const [purchaseDate, setPurchaseDate] = useState(supply?.purchaseDate ?? todayLocal());
  const [opened, setOpened] = useState(supply ? supply.status !== 'purchased' : false);
  const [openedDate, setOpenedDate] = useState(supply?.openedDate ?? todayLocal());
  const [remaining, setRemaining] = useState(
    supply ? (supply.remainingQuantity != null ? String(supply.remainingQuantity) : String(supply.quantity)) : String(quantity || ''),
  );
  const [notes, setNotes] = useState(supply?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canCreateNew = products.length > 0;

  const selectedUnitOptions = useMemo(() => {
    if (unitKind === 'count') return COUNT_UNITS;
    return WEIGHT_UNITS;
  }, [unitKind]);

  async function handleSave() {
    setError(null);
    const qty = Number(quantity);
    const prx = Number(price);
    const rem = opened ? Number(remaining) : null;

    if (!createNewProduct && !productId) {
      setError('Please select a product.');
      return;
    }
    if (isWeightUnit(unit) && (!Number.isFinite(qty) || qty <= 0)) {
      setError('Quantity must be a positive number.');
      return;
    }
    if (unitKind === 'count' && (!Number.isInteger(qty) || qty <= 0)) {
      setError('Quantity must be a positive whole number.');
      return;
    }
    if (!Number.isFinite(prx) || prx < 0) {
      setError('Price must be zero or a positive number.');
      return;
    }
    if (opened && openedDate < purchaseDate) {
      setError('Opening date cannot be before purchase date.');
      return;
    }
    if (opened && rem != null && (Number.isNaN(rem) || rem < 0 || rem > qty)) {
      setError('Remaining quantity must be between 0 and the original quantity.');
      return;
    }

    setSaving(true);
    try {
      let targetProductId = productId;
      if (createNewProduct) {
        if (!brand.trim()) {
          setError('Please enter a brand.');
          return;
        }
        if (!productName.trim()) {
          setError('Please enter a product name.');
          return;
        }
        const newProduct = await createProduct({
          category,
          brand: brand.trim(),
          name: productName.trim(),
          foodType: category === 'food' ? foodType : null,
          unitKind,
          defaultUnit: unit,
        });
        targetProductId = newProduct.id;
      }

      const input: SupplyInput = {
        productId: targetProductId,
        quantity: qty,
        unit,
        price: prx,
        purchaseDate,
        openedDate: opened ? openedDate : null,
        remainingQuantity: opened ? rem : null,
        notes: notes.trim(),
      };

      if (supply) {
        await updateSupply(supply.id, input);
      } else {
        await createSupply(input);
      }
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save supply.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={supply ? 'Edit Supply' : category === 'litter' ? 'Add Litter' : 'Add Food'} onClose={onClose}>
      <div className="form">
        {!createNewProduct ? (
          <div className="field">
            <label htmlFor="product" className="field__label">Product</label>
            <select
              id="product"
              className="field__select"
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                const p = products.find((x) => x.id === e.target.value);
                if (p) {
                  setUnit(p.defaultUnit);
                  setUnitKind(p.unitKind);
                }
              }}
            >
              <option value="">Select product…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.brand} {p.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {canCreateNew && !createNewProduct ? (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setCreateNewProduct(true)}>
            + New product
          </button>
        ) : null}

        {canCreateNew && createNewProduct ? (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setCreateNewProduct(false)}>
            ← Choose existing product
          </button>
        ) : null}

        {createNewProduct ? (
          <>
            <div className="field">
              <label htmlFor="brand" className="field__label">Brand</label>
              <input id="brand" className="field__input" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Fresh Step" />
            </div>
            <div className="field">
              <label htmlFor="pname" className="field__label">Product name</label>
              <input id="pname" className="field__input" value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="e.g. Unscented Clumping" />
            </div>
            {category === 'food' ? (
              <div className="field">
                <label htmlFor="foodtype" className="field__label">Food type</label>
                <select id="foodtype" className="field__select" value={foodType} onChange={(e) => setFoodType(e.target.value as typeof foodType)}>
                  <option value="dry">Dry</option>
                  <option value="wet">Wet</option>
                  <option value="treat">Treat</option>
                  <option value="other">Other</option>
                </select>
              </div>
            ) : null}
            <div className="field">
              <label className="field__label">Unit kind</label>
              <div className="flex-row">
                <button type="button" className={`btn btn--sm ${unitKind === 'weight' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => { setUnitKind('weight'); setUnit('kg'); }}>
                  Weight (g/kg)
                </button>
                <button type="button" className={`btn btn--sm ${unitKind === 'count' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => { setUnitKind('count'); setUnit('pouch'); }}>
                  Count
                </button>
              </div>
            </div>
          </>
        ) : null}

        <div className="form-row">
          <div className="field">
            <label htmlFor="qty" className="field__label">Quantity</label>
            <input
              id="qty"
              className="field__input"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={unitKind === 'count' ? 'e.g. 24' : 'e.g. 10'}
            />
          </div>
          <div className="field">
            <label htmlFor="unit" className="field__label">Unit</label>
            <select
              id="unit"
              className="field__select"
              value={unit}
              onChange={(e) => setUnit(e.target.value as UnitCode)}
              disabled={!createNewProduct}
            >
              {selectedUnitOptions.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="price" className="field__label">Price</label>
          <input
            id="price"
            className="field__input"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0"
          />
        </div>

        <div className="field">
          <label htmlFor="pdate" className="field__label">Purchase date</label>
          <input
            id="pdate"
            className="field__input"
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
          />
        </div>

        <div className="checkbox-row">
          <input id="opened" type="checkbox" checked={opened} onChange={(e) => setOpened(e.target.checked)} disabled={Boolean(supply && supply.status !== 'purchased')} />
          <label htmlFor="opened">Opened?</label>
        </div>

        {opened ? (
          <>
            <div className="field">
              <label htmlFor="odate" className="field__label">Opening date</label>
              <input id="odate" className="field__input" type="date" value={openedDate} onChange={(e) => setOpenedDate(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="rem" className="field__label">Remaining quantity</label>
              <input
                id="rem"
                className="field__input"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={remaining}
                onChange={(e) => setRemaining(e.target.value)}
              />
              <span className="field__hint">Current physical inventory estimate.</span>
            </div>
          </>
        ) : null}

        <div className="field">
          <label htmlFor="notes" className="field__label">Notes</label>
          <input id="notes" className="field__input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <FieldError message={error ?? undefined} />

        <button className="btn btn--primary btn--block" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Modal>
  );
}