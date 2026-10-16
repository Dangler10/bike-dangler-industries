// ============================================
// INVENTORY - feed, seed, fertiliser, chemicals... stock on hand
// Feed is drawn down automatically by the poultry daily log.
// Needs supabase/03_operations.sql (inventory_levels, receive_stock, use_stock).
// ============================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { loadFarm } from '../data';
import {
  Modal, ErrorBox, Field, FormButtons, inputClass, today, money,
  PageHeader, PrimaryButton, SmallButton, Badge, Empty, MiniStat,
} from '../components';

const TYPES = ['FEED', 'SEED', 'FERTILIZER', 'CHEMICAL', 'TOOL', 'OTHER'];
const qty = (n, unit) => `${Number(Number(n || 0).toFixed(2))}${unit ? ` ${unit}` : ''}`;

export default function InventoryPage({ role }) {
  const isOwner = role === 'OWNER';
  const canUse = role === 'OWNER' || role === 'WORKER';
  const seesMoney = role !== 'WORKER';
  const [farmId, setFarmId] = useState(null);
  const [items, setItems] = useState(null);
  const [flocks, setFlocks] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [modal, setModal] = useState(null); // { type: 'item'|'receive'|'use', item }
  const [typeFilter, setTypeFilter] = useState('ALL');

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setErrorMsg('');
    try {
      const farm = await loadFarm();
      setFarmId(farm.farm_id);
      const [lv, fl] = await Promise.all([
        supabase.from('inventory_levels').select('*').eq('farm_id', farm.farm_id).order('item_name'),
        supabase.from('flocks').select('flock_id, batch_number').eq('farm_id', farm.farm_id).eq('status', 'ACTIVE'),
      ]);
      if (lv.error) throw new Error(lv.error.message);
      setItems(lv.data || []);
      setFlocks(fl.data || []);
    } catch (e) {
      setErrorMsg(e.message);
      setItems([]);
    }
  };

  const closeModal = (changed) => {
    setModal(null);
    if (changed) load();
  };

  const all = items || [];
  const low = all.filter((i) => i.is_low || Number(i.quantity_in_stock) <= 0);
  const value = all.reduce((s, i) => s + Math.max(0, Number(i.quantity_in_stock)) * Number(i.unit_cost || 0), 0);
  const types = TYPES.filter((t) => all.some((i) => i.item_type === t));
  const shown = (typeFilter === 'ALL' ? all : all.filter((i) => i.item_type === typeFilter))
    .sort((a, b) => Number(b.is_low) - Number(a.is_low) || a.item_name.localeCompare(b.item_name));

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Inventory">
        {isOwner && <PrimaryButton onClick={() => setModal({ type: 'item' })} disabled={!farmId}>+ Add Item</PrimaryButton>}
      </PageHeader>
      <ErrorBox message={errorMsg} />

      {!items ? <p className="text-gray-500">Loading...</p> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <MiniStat label="Items" value={all.length} tone="info" />
            <MiniStat label="Low / out of stock" value={low.length} tone={low.length ? 'bad' : 'ok'} />
            {seesMoney && <MiniStat label="Stock value" value={money(value)} tone="info" sub="at last purchase price" />}
          </div>

          {types.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {['ALL', ...types].map((t) => (
                <SmallButton key={t} tone={typeFilter === t ? 'green' : 'gray'} onClick={() => setTypeFilter(t)}>
                  {t === 'ALL' ? 'All' : t.toLowerCase()}
                </SmallButton>
              ))}
            </div>
          )}

          {shown.length === 0 ? (
            <Empty>
              No stock items yet.{isOwner && ' Add your broiler feed first: daily poultry logs then take feed out of stock automatically.'}
            </Empty>
          ) : (
            <div className="bg-white rounded-lg shadow divide-y">
              {shown.map((i) => {
                const out = Number(i.quantity_in_stock) <= 0;
                return (
                  <div key={i.item_id} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-gray-800">{i.item_name}</p>
                        <Badge>{i.item_type.toLowerCase()}</Badge>
                        {out ? <Badge tone="red">Out of stock</Badge> : i.is_low && <Badge tone="orange">Low</Badge>}
                      </div>
                      <p className="text-sm text-gray-600">
                        {[
                          i.used_last_7_days > 0 && `${qty(i.used_last_7_days / 7, i.unit_of_measure)}/day lately`,
                          i.days_left != null && !out && `~${Math.floor(i.days_left)} days left`,
                          i.reorder_level != null && `reorder at ${qty(i.reorder_level, i.unit_of_measure)}`,
                          seesMoney && i.unit_cost && `${money(i.unit_cost)}/${i.unit_of_measure || 'unit'}`,
                          i.supplier_name,
                        ].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <p className={`text-2xl font-bold md:w-40 md:text-right ${out ? 'text-red-600' : i.is_low ? 'text-orange-600' : 'text-gray-800'}`}>
                      {qty(i.quantity_in_stock, i.unit_of_measure)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {isOwner && <SmallButton tone="green" onClick={() => setModal({ type: 'receive', item: i })}>Delivery</SmallButton>}
                      {canUse && <SmallButton tone="blue" onClick={() => setModal({ type: 'use', item: i })}>Use</SmallButton>}
                      {isOwner && <SmallButton onClick={() => setModal({ type: 'item', item: i })}>Edit</SmallButton>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-xs text-gray-500 mt-3">
            Feed given in the poultry daily log is taken out of stock automatically.
          </p>
        </>
      )}

      {modal?.type === 'item' && <ItemModal farmId={farmId} item={modal.item} onClose={closeModal} />}
      {modal?.type === 'receive' && <ReceiveModal item={modal.item} flocks={flocks} onClose={closeModal} />}
      {modal?.type === 'use' && <UseModal item={modal.item} flocks={flocks} onClose={closeModal} />}
    </div>
  );
}

function ItemModal({ farmId, item, onClose }) {
  const editing = !!item;
  const [form, setForm] = useState({
    item_name: item?.item_name || '',
    item_type: item?.item_type || 'FEED',
    unit_of_measure: item?.unit_of_measure || 'kg',
    supplier_name: item?.supplier_name || '',
    reorder_level: item?.reorder_level != null ? String(Number(item.reorder_level)) : '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const row = {
      item_name: form.item_name.trim(),
      item_type: form.item_type,
      unit_of_measure: form.unit_of_measure.trim() || null,
      supplier_name: form.supplier_name.trim() || null,
    };
    let itemId = item?.item_id;
    if (editing) {
      const { error: upErr } = await supabase.from('inventory_items').update(row).eq('item_id', itemId);
      if (upErr) { setSaving(false); setError(upErr.message); return; }
    } else {
      const { data, error: insErr } = await supabase.from('inventory_items').insert({ ...row, farm_id: farmId }).select('item_id').single();
      if (insErr) { setSaving(false); setError(insErr.message); return; }
      itemId = data.item_id;
    }
    // The stock row holds the reorder level. Never write the quantity here:
    // it only changes through deliveries, use and feed logs.
    const reorder = form.reorder_level === '' ? null : Number(form.reorder_level);
    const { data: updated, error: updErr } = await supabase.from('inventory_stock')
      .update({ reorder_level: reorder }).eq('item_id', itemId).select('item_id');
    let stockErr = updErr;
    if (!updErr && (!updated || updated.length === 0)) {
      ({ error: stockErr } = await supabase.from('inventory_stock')
        .insert({ item_id: itemId, quantity_in_stock: 0, reorder_level: reorder }));
    }
    setSaving(false);
    if (stockErr) setError(stockErr.message);
    else onClose(true);
  };

  const remove = async () => {
    if (!window.confirm(`Delete ${item.item_name}? Only possible if it has never been used.`)) return;
    setSaving(true);
    let { error: delErr } = await supabase.from('inventory_stock').delete().eq('item_id', item.item_id);
    if (!delErr) ({ error: delErr } = await supabase.from('inventory_items').delete().eq('item_id', item.item_id));
    setSaving(false);
    if (delErr) setError(delErr.message.includes('foreign key') ? 'This item has usage history, so it can\'t be deleted.' : delErr.message);
    else onClose(true);
  };

  return (
    <Modal onClose={() => onClose(false)}>
      <h3 className="text-2xl font-bold mb-4">{editing ? 'Edit Item' : 'Add Stock Item'}</h3>
      <ErrorBox message={error} />
      <form onSubmit={save} className="space-y-4">
        <Field label="Name">
          <input className={inputClass} placeholder="e.g. Broiler starter crumbs" value={form.item_name} onChange={set('item_name')} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select className={inputClass} value={form.item_type} onChange={set('item_type')}>
              {TYPES.map((t) => <option key={t} value={t}>{t.toLowerCase()}</option>)}
            </select>
          </Field>
          <Field label="Unit">
            <input className={inputClass} list="units" value={form.unit_of_measure} onChange={set('unit_of_measure')} />
            <datalist id="units">{['kg', 'litres', 'bags', 'doses', 'pieces'].map((u) => <option key={u} value={u} />)}</datalist>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Reorder when below" hint="Shows as Low">
            <input className={inputClass} type="number" min="0" step="0.1" value={form.reorder_level} onChange={set('reorder_level')} />
          </Field>
          <Field label="Supplier">
            <input className={inputClass} value={form.supplier_name} onChange={set('supplier_name')} />
          </Field>
        </div>
        {!editing && <p className="text-sm text-gray-600">Starts at 0. Use "Delivery" to add what you have.</p>}
        <FormButtons saving={saving} onCancel={() => onClose(false)} />
        {editing && (
          <button type="button" onClick={remove} disabled={saving} className="w-full text-sm text-red-600 hover:text-red-700 py-1">
            Delete item
          </button>
        )}
      </form>
    </Modal>
  );
}

function ReceiveModal({ item, flocks, onClose }) {
  const [form, setForm] = useState({ quantity: '', total_cost: '', date: today(), payment_method: '', flock_id: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const unitCost = Number(form.quantity) > 0 && Number(form.total_cost) > 0 ? Number(form.total_cost) / Number(form.quantity) : null;

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const { error: rpcError } = await supabase.rpc('receive_stock', {
      p_item_id: item.item_id,
      p_quantity: Number(form.quantity),
      p_total_cost: form.total_cost === '' ? null : Number(form.total_cost),
      p_date: form.date,
      p_payment_method: form.payment_method.trim() || null,
      p_flock_id: form.flock_id || null,
      p_planting_id: null,
      p_notes: form.notes.trim() || null,
    });
    setSaving(false);
    if (rpcError) setError(rpcError.message);
    else onClose(true);
  };

  return (
    <Modal onClose={() => onClose(false)}>
      <h3 className="text-2xl font-bold mb-1">Delivery · {item.item_name}</h3>
      <p className="text-sm text-gray-600 mb-4">Adds to stock and books the cost as an expense.</p>
      <ErrorBox message={error} />
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Quantity (${item.unit_of_measure || 'units'})`}>
            <input className={inputClass} type="number" min="0.01" step="0.01" value={form.quantity} onChange={set('quantity')} required />
          </Field>
          <Field label="Total cost (USD)" hint={unitCost ? `${money(unitCost)} per ${item.unit_of_measure || 'unit'}` : 'Leave empty if free / already paid'}>
            <input className={inputClass} type="number" min="0" step="0.01" value={form.total_cost} onChange={set('total_cost')} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input className={inputClass} type="date" value={form.date} onChange={set('date')} required />
          </Field>
          <Field label="Paid with">
            <input className={inputClass} placeholder="Cash, EcoCash..." value={form.payment_method} onChange={set('payment_method')} />
          </Field>
        </div>
        {flocks.length > 0 && (
          <Field label="Cost belongs to" hint="Tie feed to a batch to see that batch's profit">
            <select className={inputClass} value={form.flock_id} onChange={set('flock_id')}>
              <option value="">The whole farm</option>
              {flocks.map((f) => <option key={f.flock_id} value={f.flock_id}>Batch {f.batch_number}</option>)}
            </select>
          </Field>
        )}
        <Field label="Notes">
          <input className={inputClass} value={form.notes} onChange={set('notes')} />
        </Field>
        <FormButtons saving={saving} onCancel={() => onClose(false)} label="Add to Stock" />
      </form>
    </Modal>
  );
}

function UseModal({ item, flocks, onClose }) {
  const [form, setForm] = useState({ quantity: '', date: today(), reason: '', flock_id: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const { error: rpcError } = await supabase.rpc('use_stock', {
      p_item_id: item.item_id,
      p_quantity: Number(form.quantity),
      p_date: form.date,
      p_reason: form.reason.trim() || null,
      p_flock_id: form.flock_id || null,
    });
    setSaving(false);
    if (rpcError) setError(rpcError.message);
    else onClose(true);
  };

  return (
    <Modal onClose={() => onClose(false)}>
      <h3 className="text-2xl font-bold mb-1">Use · {item.item_name}</h3>
      <p className="text-sm text-gray-600 mb-4">
        {qty(item.quantity_in_stock, item.unit_of_measure)} in stock.
        {item.item_type === 'FEED' && ' Feed given to broilers is better logged in the Poultry daily log.'}
      </p>
      <ErrorBox message={error} />
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Quantity (${item.unit_of_measure || 'units'})`}>
            <input className={inputClass} type="number" min="0.01" step="0.01" max={Number(item.quantity_in_stock)} value={form.quantity} onChange={set('quantity')} required />
          </Field>
          <Field label="Date">
            <input className={inputClass} type="date" max={today()} value={form.date} onChange={set('date')} required />
          </Field>
        </div>
        <Field label="What for">
          <input className={inputClass} placeholder="e.g. Top dressing Plot A" value={form.reason} onChange={set('reason')} />
        </Field>
        {flocks.length > 0 && (
          <Field label="Batch">
            <select className={inputClass} value={form.flock_id} onChange={set('flock_id')}>
              <option value="">Not for a batch</option>
              {flocks.map((f) => <option key={f.flock_id} value={f.flock_id}>Batch {f.batch_number}</option>)}
            </select>
          </Field>
        )}
        <FormButtons saving={saving} onCancel={() => onClose(false)} label="Take from Stock" />
      </form>
    </Modal>
  );
}
