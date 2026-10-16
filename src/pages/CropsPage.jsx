// ============================================
// CROPS - plantings (logs, harvests, profit), crop calendar, fields
// Needs supabase/03_operations.sql (planting_summary, record_crop_harvest).
// ============================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { loadFarm } from '../data';
import {
  Modal, ErrorBox, Field, FormButtons, inputClass, today, addDays, money, MONTHS,
  PageHeader, PrimaryButton, SmallButton, Tabs, Badge, Empty, MiniStat,
} from '../components';

const STATUS = {
  NURSERY: { label: 'Nursery', tone: 'blue' },
  GROWING: { label: 'Growing', tone: 'green' },
  READY_FOR_HARVEST: { label: 'Harvesting', tone: 'orange' },
  HARVESTED: { label: 'Finished', tone: 'gray' },
  FAILED: { label: 'Failed', tone: 'red' },
};
const ACTIVE = ['NURSERY', 'GROWING', 'READY_FOR_HARVEST'];
const FIELD_TYPES = { GREENHOUSE: 'Greenhouse', OPEN_FIELD: 'Open field', NURSERY: 'Nursery' };

export default function CropsPage({ currentUser, role }) {
  const isOwner = role === 'OWNER';
  const canLog = role === 'OWNER' || role === 'WORKER';
  const seesMoney = role !== 'WORKER';
  const [tab, setTab] = useState('plantings');
  const [farmId, setFarmId] = useState(null);
  const [plantings, setPlantings] = useState(null);
  const [fields, setFields] = useState([]);
  const [calendar, setCalendar] = useState([]);
  const [varieties, setVarieties] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [modal, setModal] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [showFinished, setShowFinished] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setErrorMsg('');
    try {
      const farm = await loadFarm();
      setFarmId(farm.farm_id);
      const [pl, fl, cal, vr] = await Promise.all([
        supabase.from('planting_summary').select('*').eq('farm_id', farm.farm_id).order('planting_date', { ascending: false }),
        supabase.from('fields').select('*').eq('farm_id', farm.farm_id).order('field_name'),
        supabase.from('crop_calendar').select('*').eq('farm_id', farm.farm_id).order('crop_name'),
        supabase.from('crop_varieties').select('*').order('crop_name'),
      ]);
      const firstError = [pl, fl, cal].find((r) => r.error)?.error;
      if (firstError) throw new Error(firstError.message);
      setPlantings(pl.data || []);
      setFields(fl.data || []);
      setCalendar(cal.data || []);
      setVarieties(vr.data || []);
    } catch (e) {
      setErrorMsg(e.message);
      setPlantings([]);
    }
  };

  const closeModal = (changed) => {
    setModal(null);
    if (changed) load();
  };

  const setStatus = async (p, status) => {
    const { error } = await supabase.from('plantings').update({ current_status: status }).eq('planting_id', p.planting_id);
    if (error) setErrorMsg(error.message);
    else load();
  };

  const all = plantings || [];
  const active = all.filter((p) => ACTIVE.includes(p.current_status));
  const finished = all.filter((p) => !ACTIVE.includes(p.current_status));
  const dueSoon = active.filter((p) => p.days_to_harvest != null && p.days_to_harvest <= 7).length;
  const notLogged = active.filter((p) => p.last_log_date !== today()).length;

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Crops">
        {isOwner && tab === 'plantings' && <PrimaryButton onClick={() => setModal({ type: 'planting' })} disabled={!fields.length}>+ New Planting</PrimaryButton>}
        {isOwner && tab === 'calendar' && <PrimaryButton onClick={() => setModal({ type: 'calendar' })} disabled={!farmId}>+ Add Crop</PrimaryButton>}
        {isOwner && tab === 'fields' && <PrimaryButton onClick={() => setModal({ type: 'field' })} disabled={!farmId}>+ Add Field</PrimaryButton>}
      </PageHeader>
      <ErrorBox message={errorMsg} />
      <Tabs value={tab} onChange={setTab} tabs={[['plantings', 'Plantings'], ['calendar', 'Crop calendar'], ['fields', 'Fields']]} />

      {!plantings ? <p className="text-gray-500">Loading...</p> : (
        <>
          {tab === 'plantings' && (
            <>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <MiniStat label="Growing now" value={active.length} tone="info" />
                <MiniStat label="Harvest within 7 days" value={dueSoon} tone={dueSoon ? 'warn' : 'ok'} />
                <MiniStat label="Not logged today" value={notLogged} tone={notLogged ? 'warn' : 'ok'} />
              </div>
              {(showFinished ? all : active).length === 0 ? (
                <Empty>
                  Nothing planted right now.
                  {isOwner && (fields.length ? ' Use "+ New Planting" when you sow or transplant.' : ' Add a field first (Fields tab).')}
                </Empty>
              ) : (
                <div className="space-y-4">
                  {(showFinished ? all : active).map((p) => (
                    <PlantingCard
                      key={p.planting_id} p={p} isOwner={isOwner} canLog={canLog} seesMoney={seesMoney}
                      expanded={expandedId === p.planting_id}
                      onToggle={() => setExpandedId(expandedId === p.planting_id ? null : p.planting_id)}
                      onLog={() => setModal({ type: 'log', p })}
                      onHarvest={() => setModal({ type: 'harvest', p })}
                      onStatus={(s) => setStatus(p, s)}
                    />
                  ))}
                </div>
              )}
              {finished.length > 0 && (
                <button onClick={() => setShowFinished(!showFinished)} className="mt-6 text-green-700 font-semibold">
                  {showFinished ? 'Hide finished plantings' : `Show finished plantings (${finished.length})`}
                </button>
              )}
            </>
          )}

          {tab === 'calendar' && (
            <CalendarView calendar={calendar} isOwner={isOwner} seesMoney={seesMoney} onEdit={(row) => setModal({ type: 'calendar', row })} />
          )}

          {tab === 'fields' && (
            fields.length === 0 ? <Empty>No fields yet.</Empty> : (
              <div className="bg-white rounded-lg shadow divide-y">
                {fields.map((f) => {
                  const growing = active.filter((p) => p.field_id === f.field_id);
                  return (
                    <div key={f.field_id} className="p-4 flex flex-wrap justify-between items-center gap-3">
                      <div>
                        <p className="font-semibold text-gray-800">{f.field_name}</p>
                        <p className="text-sm text-gray-600">
                          {[FIELD_TYPES[f.field_type], f.area_sqm && `${f.area_sqm} m²`, f.irrigation && `${f.irrigation.toLowerCase()} irrigation`].filter(Boolean).join(' · ')}
                        </p>
                        <p className="text-sm text-gray-500">
                          {growing.length ? `Growing: ${growing.map((p) => p.crop_name).join(', ')}` : 'Empty'}
                        </p>
                      </div>
                      {isOwner && <SmallButton onClick={() => setModal({ type: 'field', row: f })}>Edit</SmallButton>}
                    </div>
                  );
                })}
              </div>
            )
          )}
        </>
      )}

      {modal?.type === 'planting' && (
        <PlantingModal farmId={farmId} fields={fields} calendar={calendar} varieties={varieties} currentUser={currentUser} onClose={closeModal} />
      )}
      {modal?.type === 'log' && <CropLogModal p={modal.p} currentUser={currentUser} onClose={closeModal} />}
      {modal?.type === 'harvest' && <HarvestModal p={modal.p} calendar={calendar} onClose={closeModal} />}
      {modal?.type === 'calendar' && <CalendarModal farmId={farmId} row={modal.row} onClose={closeModal} />}
      {modal?.type === 'field' && <FieldModal farmId={farmId} row={modal.row} onClose={closeModal} />}
    </div>
  );
}

// ============================================
// PLANTING CARD + HISTORY
// ============================================

function PlantingCard({ p, isOwner, canLog, seesMoney, expanded, onToggle, onLog, onHarvest, onStatus }) {
  const isActive = ACTIVE.includes(p.current_status);
  const d = p.days_to_harvest;
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 md:p-6">
        <div className="flex flex-wrap justify-between items-start gap-2">
          <div>
            <h3 className="text-xl font-bold">{p.crop_name}</h3>
            <p className="text-gray-600 text-sm">
              {p.field_name} · planted {p.planting_date}{p.area_planted_sqm ? ` · ${p.area_planted_sqm} m²` : ''}
            </p>
          </div>
          {isOwner ? (
            <select
              value={p.current_status}
              onChange={(e) => onStatus(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm font-semibold"
              aria-label="Planting status"
            >
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          ) : <Badge tone={STATUS[p.current_status]?.tone}>{STATUS[p.current_status]?.label}</Badge>}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
          <Fig label="Age" value={`${p.age_days} days`} />
          <Fig label="Harvest" value={!p.expected_harvest_date ? '—' : !isActive ? p.expected_harvest_date
            : d > 0 ? `in ${d} days` : d === 0 ? 'today' : `${-d} days ago`} />
          <Fig label="Harvested" value={`${Number(p.harvested_kg)} kg${p.expected_yield_kg ? ` of ~${Number(p.expected_yield_kg)}` : ''}`} />
          <Fig label="Last log" value={p.last_log_date || 'never'} />
          {seesMoney && (
            <>
              <Fig label="Costs" value={money(p.expenses)} />
              <Fig label="Sales" value={money(p.revenue)} />
              <Fig label="Profit" value={money(p.profit)} className={Number(p.profit) >= 0 ? 'text-green-700' : 'text-red-600'} />
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          {isActive && canLog && (
            <SmallButton tone="green" onClick={onLog}>{p.last_log_date === today() ? "Edit today's log" : 'Log today'}</SmallButton>
          )}
          {isActive && isOwner && <SmallButton tone="blue" onClick={onHarvest}>Record harvest</SmallButton>}
          <SmallButton onClick={onToggle}>{expanded ? 'Hide history' : 'History'}</SmallButton>
        </div>
        {p.notes && <p className="text-sm text-gray-500 mt-3">{p.notes}</p>}
      </div>
      {expanded && <PlantingHistory plantingId={p.planting_id} seesMoney={seesMoney} />}
    </div>
  );
}

function Fig({ label, value, className = 'text-gray-800' }) {
  return (
    <div>
      <p className="text-gray-500">{label}</p>
      <p className={`font-semibold ${className}`}>{value}</p>
    </div>
  );
}

function PlantingHistory({ plantingId, seesMoney }) {
  const [logs, setLogs] = useState(null);
  const [harvests, setHarvests] = useState([]);
  useEffect(() => {
    Promise.all([
      supabase.from('crop_daily_logs').select('*').eq('planting_id', plantingId).order('log_date', { ascending: false }),
      supabase.from('crop_harvests').select('*').eq('planting_id', plantingId).order('harvest_date', { ascending: false }),
    ]).then(([l, h]) => {
      setLogs(l.data || []);
      setHarvests(h.data || []);
    });
  }, [plantingId]);
  if (!logs) return <p className="px-6 pb-4 text-gray-500">Loading...</p>;
  return (
    <div className="border-t px-4 md:px-6 py-4 space-y-6 text-sm">
      {harvests.length > 0 && (
        <div className="overflow-x-auto">
          <h4 className="font-bold mb-2">Harvests</h4>
          <table className="w-full">
            <thead className="text-left text-gray-500">
              <tr><th className="py-1 pr-4">Date</th><th className="pr-4">Kg</th>{seesMoney && <><th className="pr-4">Price/kg</th><th className="pr-4">Total</th></>}<th>Buyer</th></tr>
            </thead>
            <tbody>
              {harvests.map((h) => (
                <tr key={h.harvest_id} className="border-t">
                  <td className="py-1 pr-4">{h.harvest_date}</td>
                  <td className="pr-4">{Number(h.quantity_harvested_kg)}</td>
                  {seesMoney && <><td className="pr-4">{money(h.market_price_per_kg)}</td><td className="pr-4">{money(h.total_revenue)}</td></>}
                  <td>{h.buyer_name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="overflow-x-auto">
        <h4 className="font-bold mb-2">Daily logs</h4>
        {logs.length === 0 ? <p className="text-gray-500">No logs yet.</p> : (
          <table className="w-full">
            <thead className="text-left text-gray-500">
              <tr><th className="py-1 pr-4">Date</th><th className="pr-4">Health</th><th className="pr-4">Water</th><th className="pr-4">Fertiliser</th><th>Pests / notes</th></tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.log_id} className="border-t align-top">
                  <td className="py-1 pr-4 whitespace-nowrap">{l.log_date}</td>
                  <td className="pr-4">{l.health_status ? l.health_status.toLowerCase() : '—'}{l.height_cm ? ` · ${Number(l.height_cm)} cm` : ''}</td>
                  <td className="pr-4 whitespace-nowrap">{l.irrigation_ml ? `${l.irrigation_ml / 1000} L` : '—'}</td>
                  <td className="pr-4 whitespace-nowrap">{l.fertilizer_applied_kg ? `${Number(l.fertilizer_applied_kg)} kg` : '—'}</td>
                  <td className="text-gray-700">{[l.pest_observations, l.notes].filter(Boolean).join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ============================================
// CROP CALENDAR
// ============================================

// Month numbers (1-12) a crop is in nursery / being planted / harvested.
function calendarMonths(c) {
  const span = (start, days) => {
    if (!start) return [];
    const n = Math.max(1, Math.ceil((days || 30) / 30));
    return Array.from({ length: n }, (_, i) => ((start - 1 + i) % 12) + 1);
  };
  return {
    nursery: span(c.nursery_start_month, c.nursery_duration_days),
    plant: [c.transplant_month || c.optimal_planting_month].filter(Boolean),
    harvest: span(c.harvest_start_month, 60),
  };
}

function CalendarView({ calendar, isOwner, seesMoney, onEdit }) {
  const thisMonth = new Date().getMonth() + 1;
  if (calendar.length === 0) {
    return <Empty>No crops in the calendar yet.{isOwner && ' Add the crops you grow with their planting and harvest months.'}</Empty>;
  }
  return (
    <>
      <div className="bg-white rounded-lg shadow p-4 overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr>
              <th className="text-left py-2 pr-3">Crop</th>
              {MONTHS.map((m, i) => (
                <th key={m} className={`text-center font-semibold px-1 ${i + 1 === thisMonth ? 'text-green-700' : 'text-gray-500'}`}>{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {calendar.map((c) => {
              const m = calendarMonths(c);
              return (
                <tr key={c.calendar_id} className="border-t">
                  <td className="py-2 pr-3 font-semibold whitespace-nowrap">
                    {isOwner ? <button onClick={() => onEdit(c)} className="hover:text-green-700 underline decoration-dotted">{c.crop_name}</button> : c.crop_name}
                  </td>
                  {MONTHS.map((_, i) => {
                    const n = i + 1;
                    const cls = m.plant.includes(n) ? 'bg-green-500 text-white'
                      : m.harvest.includes(n) ? 'bg-orange-400 text-white'
                        : m.nursery.includes(n) ? 'bg-blue-200 text-blue-900' : '';
                    const txt = m.plant.includes(n) ? 'P' : m.harvest.includes(n) ? 'H' : m.nursery.includes(n) ? 'N' : '';
                    return (
                      <td key={n} className={`px-0.5 py-1 ${n === thisMonth ? 'bg-green-50' : ''}`}>
                        <div className={`h-7 rounded text-center leading-7 text-xs font-bold ${cls}`}>{txt}</div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-600">
          <span><span className="inline-block w-3 h-3 rounded bg-blue-200 mr-1" />N = nursery</span>
          <span><span className="inline-block w-3 h-3 rounded bg-green-500 mr-1" />P = plant / transplant</span>
          <span><span className="inline-block w-3 h-3 rounded bg-orange-400 mr-1" />H = harvest</span>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        {calendar.map((c) => (
          <div key={c.calendar_id} className="bg-white rounded-lg shadow p-4 text-sm">
            <p className="font-bold text-base mb-1">{c.crop_name}</p>
            <p className="text-gray-600">
              {[c.days_to_harvest && `${c.days_to_harvest} days to harvest`,
                c.nursery_duration_days && `${c.nursery_duration_days} days in nursery`,
                c.expected_yield_kg_per_sqm && `~${Number(c.expected_yield_kg_per_sqm)} kg/m²`,
                seesMoney && c.peak_season_price_per_kg && `peak ${money(c.peak_season_price_per_kg)}/kg`].filter(Boolean).join(' · ')}
            </p>
          </div>
        ))}
      </div>
    </>
  );
}

function CalendarModal({ farmId, row, onClose }) {
  const editing = !!row;
  const s = (v) => (v == null ? '' : String(Number(v)));
  const [form, setForm] = useState({
    crop_name: row?.crop_name || '',
    nursery_start_month: s(row?.nursery_start_month),
    nursery_duration_days: s(row?.nursery_duration_days),
    optimal_planting_month: s(row?.optimal_planting_month),
    transplant_month: s(row?.transplant_month),
    days_to_harvest: s(row?.days_to_harvest),
    harvest_start_month: s(row?.harvest_start_month),
    expected_yield_kg_per_sqm: s(row?.expected_yield_kg_per_sqm),
    peak_season_price_per_kg: s(row?.peak_season_price_per_kg),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const n = (v) => (v === '' ? null : Number(v));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const out = {
      crop_name: form.crop_name.trim(),
      nursery_start_month: n(form.nursery_start_month),
      nursery_duration_days: n(form.nursery_duration_days),
      optimal_planting_month: n(form.optimal_planting_month),
      transplant_month: n(form.transplant_month),
      days_to_harvest: n(form.days_to_harvest),
      harvest_start_month: n(form.harvest_start_month),
      expected_yield_kg_per_sqm: n(form.expected_yield_kg_per_sqm),
      peak_season_price_per_kg: n(form.peak_season_price_per_kg),
    };
    const { error: saveError } = editing
      ? await supabase.from('crop_calendar').update(out).eq('calendar_id', row.calendar_id)
      : await supabase.from('crop_calendar').insert({ ...out, farm_id: farmId });
    setSaving(false);
    if (saveError) setError(saveError.message);
    else onClose(true);
  };

  const remove = async () => {
    if (!window.confirm(`Remove ${row.crop_name} from the calendar? Plantings are not affected.`)) return;
    const { error: delError } = await supabase.from('crop_calendar').delete().eq('calendar_id', row.calendar_id);
    if (delError) setError(delError.message);
    else onClose(true);
  };

  const monthSelect = (k, label) => (
    <Field label={label}>
      <select className={inputClass} value={form[k]} onChange={set(k)}>
        <option value="">—</option>
        {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </select>
    </Field>
  );

  return (
    <Modal onClose={() => onClose(false)}>
      <h3 className="text-2xl font-bold mb-4">{editing ? `Edit ${row.crop_name}` : 'Add Crop to Calendar'}</h3>
      <ErrorBox message={error} />
      <form onSubmit={save} className="space-y-4">
        <Field label="Crop">
          <input className={inputClass} placeholder="e.g. Green pepper" value={form.crop_name} onChange={set('crop_name')} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          {monthSelect('nursery_start_month', 'Nursery from')}
          <Field label="Days in nursery">
            <input className={inputClass} type="number" min="0" value={form.nursery_duration_days} onChange={set('nursery_duration_days')} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {monthSelect('optimal_planting_month', 'Best planting month')}
          {monthSelect('transplant_month', 'Transplant month')}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Days to harvest">
            <input className={inputClass} type="number" min="1" value={form.days_to_harvest} onChange={set('days_to_harvest')} />
          </Field>
          {monthSelect('harvest_start_month', 'Harvest from')}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Yield (kg per m²)">
            <input className={inputClass} type="number" min="0" step="0.1" value={form.expected_yield_kg_per_sqm} onChange={set('expected_yield_kg_per_sqm')} />
          </Field>
          <Field label="Peak price (USD/kg)">
            <input className={inputClass} type="number" min="0" step="0.01" value={form.peak_season_price_per_kg} onChange={set('peak_season_price_per_kg')} />
          </Field>
        </div>
        <FormButtons saving={saving} onCancel={() => onClose(false)} />
        {editing && <button type="button" onClick={remove} className="w-full text-sm text-red-600 py-1">Remove from calendar</button>}
      </form>
    </Modal>
  );
}

// ============================================
// NEW PLANTING / DAILY LOG / HARVEST
// ============================================

function PlantingModal({ farmId, fields, calendar, varieties, currentUser, onClose }) {
  const [form, setForm] = useState({
    field_id: fields[0]?.field_id || '', crop_name: '', planting_date: today(), expected_harvest_date: '',
    current_status: 'GROWING', area_planted_sqm: '', expected_yield_kg: '', seed_quantity_kg: '', seed_cost: '',
    payment_method: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const guide = (crop) => {
    const name = crop.trim().toLowerCase();
    const c = calendar.find((x) => x.crop_name.toLowerCase() === name);
    const v = varieties.find((x) => x.crop_name.toLowerCase() === name);
    return { days: c?.days_to_harvest || v?.typical_cycle_days, yieldPerSqm: c?.expected_yield_kg_per_sqm || v?.typical_yield_kg_per_sqm };
  };

  // Fill harvest date and expected yield from the crop calendar when possible.
  const update = (changes) => {
    const next = { ...form, ...changes };
    const g = guide(next.crop_name);
    if (('crop_name' in changes || 'planting_date' in changes) && g.days && next.planting_date) {
      next.expected_harvest_date = addDays(next.planting_date, Number(g.days));
    }
    if (('crop_name' in changes || 'area_planted_sqm' in changes) && g.yieldPerSqm && next.area_planted_sqm) {
      next.expected_yield_kg = String(Math.round(Number(next.area_planted_sqm) * Number(g.yieldPerSqm)));
    }
    setForm(next);
  };
  const set = (k) => (e) => update({ [k]: e.target.value });
  const field = fields.find((f) => f.field_id === form.field_id);
  const cropNames = [...new Set([...calendar.map((c) => c.crop_name), ...varieties.map((v) => v.crop_name)])];

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const { data, error: insErr } = await supabase.from('plantings').insert({
      field_id: form.field_id,
      crop_name: form.crop_name.trim(),
      planting_date: form.planting_date,
      expected_harvest_date: form.expected_harvest_date || null,
      current_status: form.current_status,
      area_planted_sqm: form.area_planted_sqm === '' ? null : parseInt(form.area_planted_sqm, 10),
      expected_yield_kg: form.expected_yield_kg === '' ? null : Number(form.expected_yield_kg),
      seed_quantity_kg: form.seed_quantity_kg === '' ? null : Number(form.seed_quantity_kg),
      seed_cost: form.seed_cost === '' ? null : Number(form.seed_cost),
      notes: form.notes.trim() || null,
      created_by: currentUser.id,
    }).select('planting_id').single();
    if (insErr) { setSaving(false); setError(insErr.message); return; }

    if (Number(form.seed_cost) > 0) {
      const { error: txnErr } = await supabase.from('transactions').insert({
        farm_id: farmId, planting_id: data.planting_id, transaction_type: 'EXPENSE', category: 'Seeds',
        amount: Number(form.seed_cost), description: `${form.crop_name.trim()} seed/seedlings - ${field?.field_name || ''}`,
        date: form.planting_date, payment_method: form.payment_method.trim() || null, created_by: currentUser.id,
      });
      if (txnErr) { setSaving(false); setError(`Planting saved, but the seed cost wasn't: ${txnErr.message}`); return; }
    }
    setSaving(false);
    onClose(true);
  };

  return (
    <Modal onClose={() => onClose(false)}>
      <h3 className="text-2xl font-bold mb-4">New Planting</h3>
      <ErrorBox message={error} />
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Field">
            <select className={inputClass} value={form.field_id} onChange={set('field_id')} required>
              {fields.map((f) => <option key={f.field_id} value={f.field_id}>{f.field_name}</option>)}
            </select>
          </Field>
          <Field label="Crop">
            <input className={inputClass} list="crop-names" value={form.crop_name} onChange={set('crop_name')} required />
            <datalist id="crop-names">{cropNames.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Planted on">
            <input className={inputClass} type="date" value={form.planting_date} onChange={set('planting_date')} required />
          </Field>
          <Field label="Harvest expected" hint={guide(form.crop_name).days ? `${guide(form.crop_name).days} days (from calendar)` : undefined}>
            <input className={inputClass} type="date" value={form.expected_harvest_date} onChange={set('expected_harvest_date')} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Area (m²)" hint={field?.area_sqm ? `Field is ${field.area_sqm} m²` : undefined}>
            <input className={inputClass} type="number" min="1" value={form.area_planted_sqm} onChange={set('area_planted_sqm')} />
          </Field>
          <Field label="Expected yield (kg)">
            <input className={inputClass} type="number" min="0" value={form.expected_yield_kg} onChange={set('expected_yield_kg')} />
          </Field>
        </div>
        <Field label="Stage">
          <select className={inputClass} value={form.current_status} onChange={set('current_status')}>
            <option value="NURSERY">In nursery</option>
            <option value="GROWING">In the ground</option>
          </select>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Seed (kg)">
            <input className={inputClass} type="number" min="0" step="0.01" value={form.seed_quantity_kg} onChange={set('seed_quantity_kg')} />
          </Field>
          <Field label="Seed cost">
            <input className={inputClass} type="number" min="0" step="0.01" value={form.seed_cost} onChange={set('seed_cost')} />
          </Field>
          <Field label="Paid with">
            <input className={inputClass} value={form.payment_method} onChange={set('payment_method')} />
          </Field>
        </div>
        <Field label="Notes">
          <input className={inputClass} placeholder="Variety, spacing..." value={form.notes} onChange={set('notes')} />
        </Field>
        <FormButtons saving={saving} onCancel={() => onClose(false)} label="Save Planting" />
      </form>
    </Modal>
  );
}

function CropLogModal({ p, currentUser, onClose }) {
  const blank = { log_date: today(), health_status: 'GOOD', height_cm: '', irrigation_l: '', fertilizer_applied_kg: '', pest_observations: '', notes: '' };
  const [form, setForm] = useState(blank);
  const [existing, setExisting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => {
    supabase.from('crop_daily_logs').select('*').eq('planting_id', p.planting_id).eq('log_date', form.log_date).maybeSingle()
      .then(({ data }) => {
        setExisting(!!data);
        const s = (v) => (v == null ? '' : String(Number(v)));
        setForm((prev) => (data ? {
          ...prev,
          health_status: data.health_status || 'GOOD',
          height_cm: s(data.height_cm),
          irrigation_l: data.irrigation_ml == null ? '' : String(data.irrigation_ml / 1000),
          fertilizer_applied_kg: s(data.fertilizer_applied_kg),
          pest_observations: data.pest_observations || '',
          notes: data.notes || '',
        } : { ...blank, log_date: prev.log_date }));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.planting_id, form.log_date]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const { error: saveError } = await supabase.from('crop_daily_logs').upsert({
      planting_id: p.planting_id,
      log_date: form.log_date,
      health_status: form.health_status,
      height_cm: form.height_cm === '' ? null : Number(form.height_cm),
      irrigation_ml: form.irrigation_l === '' ? null : Math.round(Number(form.irrigation_l) * 1000),
      fertilizer_applied_kg: form.fertilizer_applied_kg === '' ? null : Number(form.fertilizer_applied_kg),
      pest_observations: form.pest_observations.trim() || null,
      notes: form.notes.trim() || null,
      created_by: currentUser.id,
    }, { onConflict: 'planting_id,log_date' });
    setSaving(false);
    if (saveError) setError(saveError.message);
    else onClose(true);
  };

  return (
    <Modal onClose={() => onClose(false)}>
      <h3 className="text-2xl font-bold mb-1">Crop Log · {p.crop_name}</h3>
      <p className="text-sm text-gray-600 mb-4">{p.field_name}{existing ? ' · a log exists for this date; saving corrects it' : ''}</p>
      <ErrorBox message={error} />
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input className={inputClass} type="date" min={p.planting_date} max={today()} value={form.log_date} onChange={set('log_date')} required />
          </Field>
          <Field label="Health">
            <select className={inputClass} value={form.health_status} onChange={set('health_status')}>
              <option value="GOOD">Good</option>
              <option value="FAIR">Fair</option>
              <option value="POOR">Poor</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Water (L)">
            <input className={inputClass} type="number" min="0" step="0.1" inputMode="decimal" value={form.irrigation_l} onChange={set('irrigation_l')} />
          </Field>
          <Field label="Fertiliser (kg)">
            <input className={inputClass} type="number" min="0" step="0.1" inputMode="decimal" value={form.fertilizer_applied_kg} onChange={set('fertilizer_applied_kg')} />
          </Field>
          <Field label="Height (cm)">
            <input className={inputClass} type="number" min="0" step="0.1" inputMode="decimal" value={form.height_cm} onChange={set('height_cm')} />
          </Field>
        </div>
        <Field label="Pests / disease">
          <input className={inputClass} placeholder="e.g. Aphids on 3 plants" value={form.pest_observations} onChange={set('pest_observations')} />
        </Field>
        <Field label="Notes">
          <textarea className={`${inputClass} h-16`} value={form.notes} onChange={set('notes')} />
        </Field>
        <FormButtons saving={saving} onCancel={() => onClose(false)} label={existing ? 'Update Log' : 'Save Log'} />
      </form>
    </Modal>
  );
}

function HarvestModal({ p, calendar, onClose }) {
  const cal = calendar.find((c) => c.crop_name.toLowerCase() === p.crop_name.toLowerCase());
  const [form, setForm] = useState({
    harvest_date: today(), quantity_kg: '', price_per_kg: cal?.peak_season_price_per_kg ? String(Number(cal.peak_season_price_per_kg)) : '',
    buyer_name: '', payment_method: '', quality_grade: '', notes: '',
  });
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const total = Math.round(Number(form.quantity_kg || 0) * Number(form.price_per_kg || 0) * 100) / 100;

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const { error: rpcError } = await supabase.rpc('record_crop_harvest', {
      p_planting_id: p.planting_id,
      p_harvest_date: form.harvest_date,
      p_quantity_kg: Number(form.quantity_kg),
      p_price_per_kg: form.price_per_kg === '' ? 0 : Number(form.price_per_kg),
      p_buyer_name: form.buyer_name.trim() || null,
      p_quality_grade: form.quality_grade.trim() || null,
      p_notes: form.notes.trim() || null,
      p_payment_method: form.payment_method.trim() || null,
      p_finished: finished,
    });
    setSaving(false);
    if (rpcError) setError(rpcError.message);
    else onClose(true);
  };

  return (
    <Modal onClose={() => onClose(false)}>
      <h3 className="text-2xl font-bold mb-1">Record Harvest · {p.crop_name}</h3>
      <p className="text-sm text-gray-600 mb-4">Sales go to the Partner Dashboard automatically. Leave price empty for food kept at home.</p>
      <ErrorBox message={error} />
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input className={inputClass} type="date" value={form.harvest_date} onChange={set('harvest_date')} required />
          </Field>
          <Field label="Quantity (kg)">
            <input className={inputClass} type="number" min="0.01" step="0.01" inputMode="decimal" value={form.quantity_kg} onChange={set('quantity_kg')} required />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Price per kg (USD)">
            <input className={inputClass} type="number" min="0" step="0.01" inputMode="decimal" value={form.price_per_kg} onChange={set('price_per_kg')} />
          </Field>
          <Field label="Grade">
            <input className={inputClass} placeholder="A, B..." value={form.quality_grade} onChange={set('quality_grade')} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Buyer">
            <input className={inputClass} value={form.buyer_name} onChange={set('buyer_name')} />
          </Field>
          <Field label="Paid with">
            <input className={inputClass} placeholder="Cash, EcoCash..." value={form.payment_method} onChange={set('payment_method')} />
          </Field>
        </div>
        <Field label="Notes">
          <input className={inputClass} value={form.notes} onChange={set('notes')} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={finished} onChange={(e) => setFinished(e.target.checked)} className="w-4 h-4" />
          Last harvest, this planting is finished
        </label>
        <div className="bg-green-50 border border-green-200 rounded p-3 text-sm">Sale total: <strong>{money(total)}</strong></div>
        <FormButtons saving={saving} onCancel={() => onClose(false)} label="Record Harvest" />
      </form>
    </Modal>
  );
}

function FieldModal({ farmId, row, onClose }) {
  const editing = !!row;
  const [form, setForm] = useState({
    field_name: row?.field_name || '', field_type: row?.field_type || 'OPEN_FIELD',
    area_sqm: row?.area_sqm != null ? String(row.area_sqm) : '', irrigation: row?.irrigation || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const out = {
      field_name: form.field_name.trim(), field_type: form.field_type,
      area_sqm: form.area_sqm === '' ? null : parseInt(form.area_sqm, 10), irrigation: form.irrigation.trim() || null,
    };
    const { error: saveError } = editing
      ? await supabase.from('fields').update(out).eq('field_id', row.field_id)
      : await supabase.from('fields').insert({ ...out, farm_id: farmId });
    setSaving(false);
    if (saveError) setError(saveError.message);
    else onClose(true);
  };

  return (
    <Modal onClose={() => onClose(false)}>
      <h3 className="text-2xl font-bold mb-4">{editing ? 'Edit Field' : 'Add Field'}</h3>
      <ErrorBox message={error} />
      <form onSubmit={save} className="space-y-4">
        <Field label="Name">
          <input className={inputClass} placeholder="e.g. Plot B" value={form.field_name} onChange={set('field_name')} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select className={inputClass} value={form.field_type} onChange={set('field_type')}>
              {Object.entries(FIELD_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Area (m²)">
            <input className={inputClass} type="number" min="1" value={form.area_sqm} onChange={set('area_sqm')} />
          </Field>
        </div>
        <Field label="Irrigation">
          <input className={inputClass} list="irrigation-types" value={form.irrigation} onChange={set('irrigation')} />
          <datalist id="irrigation-types">{['DRIP', 'FLOOD', 'SPRINKLER', 'RAIN-FED'].map((x) => <option key={x} value={x} />)}</datalist>
        </Field>
        <FormButtons saving={saving} onCancel={() => onClose(false)} />
      </form>
    </Modal>
  );
}
