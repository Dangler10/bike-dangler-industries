// ============================================
// POULTRY PAGE - broiler batches, daily logs, sales, batch comparison, houses
// Needs supabase/02 (flock_summary, record_flock_harvest) and
// supabase/04 (sale dates in flock_summary, delete_harvest).
// ============================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { loadFarm } from '../data';
import {
  Modal, ErrorBox, Field, FormButtons, inputClass, today, money, addDays, daysBetween, MiniStat,
  PageHeader, PrimaryButton, SmallButton, Tabs, Empty, Badge,
} from '../components';

const DEFAULT_GROWOUT_DAYS = 42;

const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

export default function PoultryPage({ currentUser, role }) {
  const isOwner = role === 'OWNER';
  const canLog = role === 'OWNER' || role === 'WORKER';
  const seesMoney = role === 'OWNER' || role === 'PARTNER';

  const [tab, setTab] = useState('batches');
  const [farmId, setFarmId] = useState(null);
  const [flocks, setFlocks] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [showClosed, setShowClosed] = useState(false);
  const [modal, setModal] = useState(null); // { type: 'new' | 'log' | 'sale' | 'house', flock?, house? }
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const farm = await loadFarm();
      setFarmId(farm.farm_id);
      const [summary, bld] = await Promise.all([
        supabase.from('flock_summary').select('*').eq('farm_id', farm.farm_id)
          .order('start_date', { ascending: false }),
        supabase.from('buildings').select('*').eq('farm_id', farm.farm_id).order('building_name'),
      ]);
      if (summary.error) setErrorMsg(summary.error.message);
      setFlocks(summary.data || []);
      setBuildings(bld.data || []);
    } catch (e) {
      setErrorMsg(e.message);
    }
    setLoading(false);
  };

  const closeModal = (changed) => {
    setModal(null);
    if (changed) load();
  };

  const houses = buildings.filter((b) => b.building_type === 'POULTRY_HOUSE');
  const active = flocks.filter((f) => f.status === 'ACTIVE' || f.status === 'PLANNED');
  const closed = flocks.filter((f) => f.status === 'HARVESTED' || f.status === 'CULLED');
  const shown = showClosed ? flocks : active;
  const birdsOnFarm = active.reduce((sum, f) => sum + f.birds_alive, 0);
  const notLoggedToday = active.filter((f) => f.status === 'ACTIVE' && f.age_days >= 0 && f.last_log_date !== today()).length;

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Poultry">
        {isOwner && tab === 'batches' && (
          <PrimaryButton onClick={() => setModal({ type: 'new' })} disabled={!farmId}>+ New Batch</PrimaryButton>
        )}
        {isOwner && tab === 'houses' && (
          <PrimaryButton onClick={() => setModal({ type: 'house' })} disabled={!farmId}>+ Add Building</PrimaryButton>
        )}
      </PageHeader>

      <ErrorBox message={errorMsg} />
      <Tabs value={tab} onChange={setTab} tabs={[['batches', 'Batches'], ['compare', 'Compare batches'], ['houses', 'Houses']]} />

      {loading ? <p className="text-gray-500">Loading...</p> : (
        <>
          {tab === 'batches' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                <MiniStat label="Active batches" value={active.length} />
                <MiniStat label="Birds on farm" value={birdsOnFarm.toLocaleString()} />
                <MiniStat label="Not logged today" value={notLoggedToday} tone={notLoggedToday > 0 ? 'warn' : 'ok'} />
              </div>

              {shown.length === 0 ? (
                <Empty>No active batches.{isOwner && ' Click "+ New Batch" when the chicks arrive.'}</Empty>
              ) : (
                <div className="space-y-4">
                  {shown.map((f) => (
                    <FlockCard
                      key={f.flock_id}
                      flock={f}
                      seesMoney={seesMoney}
                      canLog={canLog}
                      isOwner={isOwner}
                      expanded={expandedId === f.flock_id}
                      onToggle={() => setExpandedId(expandedId === f.flock_id ? null : f.flock_id)}
                      onLog={() => setModal({ type: 'log', flock: f })}
                      onSale={() => setModal({ type: 'sale', flock: f })}
                      onChanged={load}
                    />
                  ))}
                </div>
              )}

              {closed.length > 0 && (
                <button
                  onClick={() => setShowClosed(!showClosed)}
                  className="mt-6 text-green-700 hover:text-green-800 font-semibold"
                >
                  {showClosed ? 'Hide finished batches' : `Show finished batches (${closed.length})`}
                </button>
              )}
            </>
          )}

          {tab === 'compare' && <CompareBatches flocks={flocks} seesMoney={seesMoney} />}

          {tab === 'houses' && (
            <HousesView buildings={buildings} active={active} isOwner={isOwner}
              onEdit={(house) => setModal({ type: 'house', house })} />
          )}
        </>
      )}

      {modal?.type === 'new' && (
        <NewBatchModal farmId={farmId} houses={houses} flocks={flocks} currentUser={currentUser} onClose={closeModal} />
      )}
      {modal?.type === 'log' && (
        <DailyLogModal flock={modal.flock} currentUser={currentUser} onClose={closeModal} />
      )}
      {modal?.type === 'sale' && (
        <SaleModal flock={modal.flock} onClose={closeModal} />
      )}
      {modal?.type === 'house' && (
        <BuildingModal farmId={farmId} house={modal.house} onClose={closeModal} />
      )}
    </div>
  );
}

// ============================================
// COMPARE BATCHES
// ============================================
// FCR = feed eaten (kg) ÷ live weight sold (kg): lower is better.

function batchStats(f) {
  const sold = Number(f.birds_harvested);
  const weight = Number(f.total_weight_kg);
  const feed = Number(f.total_feed_kg);
  const end = f.last_sale_date || (f.status === 'ACTIVE' ? today() : null);
  return {
    days: end ? daysBetween(f.start_date, end) : null,
    avgWeight: sold > 0 ? weight / sold : null,
    fcr: weight > 0 && feed > 0 ? feed / weight : null,
    feedPerBird: f.bird_count > 0 && feed > 0 ? feed / f.bird_count : null,
    costPerBird: f.bird_count > 0 ? Number(f.expenses) / f.bird_count : null,
    profitPerBird: f.bird_count > 0 ? Number(f.profit) / f.bird_count : null,
  };
}

function CompareBatches({ flocks, seesMoney }) {
  if (flocks.length === 0) return <Empty>No batches yet.</Empty>;
  const rows = [...flocks].sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)))
    .map((f) => ({ f, s: batchStats(f) }));
  const fmt = (v, digits = 2, suffix = '') => (v == null ? '—' : `${v.toFixed(digits)}${suffix}`);
  const best = (key, lowerIsBetter) => {
    const vals = rows.map((r) => r.s[key]).filter((v) => v != null);
    if (vals.length < 2) return null;
    return lowerIsBetter ? Math.min(...vals) : Math.max(...vals);
  };
  const bestFcr = best('fcr', true);
  const bestWeight = best('avgWeight', false);
  const bestProfit = best('profitPerBird', false);
  const hi = (v, b) => (b != null && v === b ? 'text-green-700 font-bold' : '');

  return (
    <>
      <div className="bg-white rounded-lg shadow p-4 overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="text-left text-gray-500">
            <tr>
              <th className="py-2 pr-3">Batch</th>
              <th className="pr-3">Started</th>
              <th className="pr-3 text-right">Chicks</th>
              <th className="pr-3 text-right">Deaths</th>
              <th className="pr-3 text-right">Days</th>
              <th className="pr-3 text-right">Feed/bird</th>
              <th className="pr-3 text-right">Avg weight</th>
              <th className="pr-3 text-right">FCR</th>
              {seesMoney && <><th className="pr-3 text-right">Cost/bird</th><th className="pr-3 text-right">Profit/bird</th><th className="text-right">Profit</th></>}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ f, s }) => (
              <tr key={f.flock_id} className="border-t">
                <td className="py-2 pr-3 font-semibold whitespace-nowrap">
                  {f.batch_number} {f.status === 'ACTIVE' && <Badge tone="green">growing</Badge>}
                </td>
                <td className="pr-3 whitespace-nowrap">{f.start_date}</td>
                <td className="pr-3 text-right">{f.bird_count}</td>
                <td className={`pr-3 text-right ${f.mortality_pct >= 5 ? 'text-red-600' : ''}`}>{Number(f.mortality_pct || 0)}%</td>
                <td className="pr-3 text-right">{s.days ?? '—'}</td>
                <td className="pr-3 text-right">{fmt(s.feedPerBird, 2, ' kg')}</td>
                <td className={`pr-3 text-right ${hi(s.avgWeight, bestWeight)}`}>{fmt(s.avgWeight, 2, ' kg')}</td>
                <td className={`pr-3 text-right ${hi(s.fcr, bestFcr)}`}>{fmt(s.fcr)}</td>
                {seesMoney && (
                  <>
                    <td className="pr-3 text-right">{s.costPerBird == null ? '—' : money(s.costPerBird)}</td>
                    <td className={`pr-3 text-right ${hi(s.profitPerBird, bestProfit)}`}>{s.profitPerBird == null ? '—' : money(s.profitPerBird)}</td>
                    <td className={`text-right font-semibold ${Number(f.profit) >= 0 ? '' : 'text-red-600'}`}>{money(f.profit)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500 mt-3">
        Days = arrival to last sale (or to today while growing). FCR = kg of feed per kg of bird sold; lower is better
        (good broilers are around 1.6–1.9). Best value in each column is in green.
        {seesMoney && ' Costs only include expenses tied to the batch (chicks, feed deliveries, entries marked for it).'}
      </p>
    </>
  );
}

// ============================================
// HOUSES / BUILDINGS
// ============================================

const BUILDING_TYPES = { POULTRY_HOUSE: 'Poultry house', STORAGE: 'Storage', PROCESSING: 'Processing' };

function HousesView({ buildings, active, isOwner, onEdit }) {
  if (buildings.length === 0) return <Empty>No buildings yet.</Empty>;
  return (
    <div className="bg-white rounded-lg shadow divide-y">
      {buildings.map((b) => {
        const inHouse = active.filter((f) => f.building_id === b.building_id);
        const birds = inHouse.reduce((s, f) => s + f.birds_alive, 0);
        const pct = b.capacity ? Math.round((100 * birds) / b.capacity) : null;
        return (
          <div key={b.building_id} className="p-4 flex flex-wrap justify-between items-center gap-3">
            <div>
              <p className="font-semibold text-gray-800">{b.building_name}</p>
              <p className="text-sm text-gray-600">
                {[BUILDING_TYPES[b.building_type], b.capacity && `holds ${b.capacity}`, b.climate_controlled && 'climate controlled'].filter(Boolean).join(' · ')}
              </p>
              {b.building_type === 'POULTRY_HOUSE' && (
                <p className="text-sm text-gray-500">
                  {inHouse.length ? `${birds} birds (${inHouse.map((f) => f.batch_number).join(', ')})${pct != null ? ` · ${pct}% full` : ''}` : 'Empty'}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {pct != null && pct > 100 && <Badge tone="red">Over capacity</Badge>}
              {isOwner && <SmallButton onClick={() => onEdit(b)}>Edit</SmallButton>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BuildingModal({ farmId, house, onClose }) {
  const editing = !!house;
  const [form, setForm] = useState({
    building_name: house?.building_name || '',
    building_type: house?.building_type || 'POULTRY_HOUSE',
    capacity: house?.capacity != null ? String(house.capacity) : '',
    climate_controlled: !!house?.climate_controlled,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const row = {
      building_name: form.building_name.trim(),
      building_type: form.building_type,
      capacity: form.capacity === '' ? null : parseInt(form.capacity, 10),
      climate_controlled: form.climate_controlled,
    };
    const { error: saveError } = editing
      ? await supabase.from('buildings').update(row).eq('building_id', house.building_id)
      : await supabase.from('buildings').insert({ ...row, farm_id: farmId });
    setSaving(false);
    if (saveError) setError(saveError.message);
    else onClose(true);
  };

  return (
    <Modal onClose={() => onClose(false)}>
      <h3 className="text-2xl font-bold mb-4">{editing ? 'Edit Building' : 'Add Building'}</h3>
      <ErrorBox message={error} />
      <form onSubmit={save} className="space-y-4">
        <Field label="Name">
          <input className={inputClass} placeholder="e.g. Broiler House 2" value={form.building_name} onChange={set('building_name')} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select className={inputClass} value={form.building_type} onChange={set('building_type')}>
              {Object.entries(BUILDING_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Capacity (birds)">
            <input className={inputClass} type="number" min="1" value={form.capacity} onChange={set('capacity')} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.climate_controlled}
            onChange={(e) => setForm({ ...form, climate_controlled: e.target.checked })} className="w-4 h-4" />
          Climate controlled (heaters / fans)
        </label>
        <FormButtons saving={saving} onCancel={() => onClose(false)} />
      </form>
    </Modal>
  );
}

// ============================================
// BATCH CARD
// ============================================

function FlockCard({ flock: f, seesMoney, canLog, isOwner, expanded, onToggle, onLog, onSale, onChanged }) {
  const isActive = f.status === 'ACTIVE';
  const loggedToday = f.last_log_date === today();
  const daysLeft = f.expected_harvest_date
    ? Math.round((new Date(`${f.expected_harvest_date}T00:00:00`) - new Date(`${today()}T00:00:00`)) / 86400000)
    : null;
  const mortalityTone = f.mortality_pct >= 5 ? 'text-red-600' : f.mortality_pct >= 3 ? 'text-orange-600' : 'text-gray-800';

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 md:p-6">
        <div className="flex flex-wrap justify-between items-start gap-2">
          <div>
            <h3 className="text-xl font-bold">Batch {f.batch_number}</h3>
            <p className="text-gray-600 text-sm">
              {f.building_name || 'No house set'} · {f.bird_type} · started {f.start_date}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
            isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {!isActive ? f.status : f.age_days < 0 ? `Arrives in ${-f.age_days} days` : `Day ${f.age_days}`}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
          <Figure label="Birds alive" value={`${f.birds_alive} / ${f.bird_count}`} />
          <Figure label="Deaths" value={`${f.total_mortality} (${Number(f.mortality_pct || 0)}%)`} className={mortalityTone} />
          <Figure label="Feed used" value={`${Number(f.total_feed_kg)} kg`} />
          <Figure
            label={isActive ? 'Harvest due' : 'Birds sold'}
            value={isActive
              ? (daysLeft === null ? '—' : daysLeft >= 0 ? `in ${daysLeft} days` : `${-daysLeft} days ago`)
              : f.birds_harvested}
          />
          {seesMoney && (
            <>
              <Figure label="Batch costs" value={money(f.expenses)} />
              <Figure label="Sales" value={money(f.revenue)} />
              <Figure
                label="Profit so far"
                value={money(f.profit)}
                className={Number(f.profit) >= 0 ? 'text-green-700' : 'text-red-600'}
              />
            </>
          )}
        </div>

        {isActive && !loggedToday && f.age_days >= 0 && (
          <p className="mt-4 text-sm text-orange-700 bg-orange-50 rounded px-3 py-2">
            No log for today yet{f.last_log_date ? ` (last: ${f.last_log_date})` : ''}.
          </p>
        )}

        <div className="flex flex-wrap gap-2 mt-4">
          {isActive && canLog && f.age_days >= 0 && (
            <button onClick={onLog} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-semibold">
              {loggedToday ? 'Edit today\'s log' : 'Log today'}
            </button>
          )}
          {isActive && isOwner && f.birds_alive > 0 && (
            <button onClick={onSale} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-semibold">
              Record sale
            </button>
          )}
          <button onClick={onToggle} className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded font-semibold">
            {expanded ? 'Hide history' : 'History'}
          </button>
        </div>
      </div>

      {expanded && <FlockHistory flockId={f.flock_id} seesMoney={seesMoney} isOwner={isOwner} onChanged={onChanged} />}
    </div>
  );
}

function Figure({ label, value, className = 'text-gray-800' }) {
  return (
    <div>
      <p className="text-gray-500">{label}</p>
      <p className={`font-semibold ${className}`}>{value}</p>
    </div>
  );
}

// ============================================
// HISTORY (daily logs + sales)
// ============================================

function FlockHistory({ flockId, seesMoney, isOwner, onChanged }) {
  const [logs, setLogs] = useState(null);
  const [sales, setSales] = useState([]);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  // Removes the sale and its income; a closed batch reopens if birds are left.
  const deleteSale = async (s) => {
    if (!window.confirm(`Delete the sale of ${s.birds_harvested} birds on ${s.harvest_date}? Its income is removed too.`)) return;
    const { error: delError } = await supabase.rpc('delete_harvest', { p_kind: 'flock', p_harvest_id: s.harvest_id });
    if (delError) setError(delError.message);
    else { setReload((n) => n + 1); onChanged(); }
  };

  useEffect(() => {
    (async () => {
      const [l, s] = await Promise.all([
        supabase.from('flock_daily_logs')
          .select('log_id, log_date, mortality, feed_given_kg, water_given_liters, health_notes')
          .eq('flock_id', flockId).order('log_date', { ascending: false }),
        supabase.from('flock_harvesting')
          .select('harvest_id, harvest_date, birds_harvested, total_weight_kg, average_weight_kg, sale_price_per_kg, total_revenue, buyer_name')
          .eq('flock_id', flockId).order('harvest_date', { ascending: false }),
      ]);
      setError(l.error?.message || s.error?.message || '');
      setLogs(l.data || []);
      setSales(s.data || []);
    })();
  }, [flockId, reload]);

  if (!logs) return <p className="px-6 pb-6 text-gray-500">Loading...</p>;

  return (
    <div className="border-t px-4 md:px-6 py-4 space-y-6">
      <ErrorBox message={error} />

      {sales.length > 0 && (
        <div>
          <h4 className="font-bold mb-2">Sales</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-gray-500">
                <tr>
                  <th className="py-1 pr-4">Date</th><th className="pr-4">Birds</th><th className="pr-4">Weight</th>
                  <th className="pr-4">Avg</th>{seesMoney && <><th className="pr-4">Price/kg</th><th className="pr-4">Total</th></>}
                  <th>Buyer</th>{isOwner && <th />}
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.harvest_id} className="border-t">
                    <td className="py-1 pr-4">{s.harvest_date}</td>
                    <td className="pr-4">{s.birds_harvested}</td>
                    <td className="pr-4">{Number(s.total_weight_kg)} kg</td>
                    <td className="pr-4">{s.average_weight_kg ? `${Number(s.average_weight_kg)} kg` : '—'}</td>
                    {seesMoney && <><td className="pr-4">{money(s.sale_price_per_kg)}</td><td className="pr-4">{money(s.total_revenue)}</td></>}
                    <td>{s.buyer_name || '—'}</td>
                    {isOwner && (
                      <td className="text-right">
                        <button onClick={() => deleteSale(s)} className="text-xs text-gray-500 hover:text-red-600">Delete</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <h4 className="font-bold mb-2">Daily logs</h4>
        {logs.length === 0 ? (
          <p className="text-gray-500 text-sm">No logs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-gray-500">
                <tr>
                  <th className="py-1 pr-4">Date</th><th className="pr-4">Deaths</th>
                  <th className="pr-4">Feed</th><th className="pr-4">Water</th><th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.log_id} className="border-t align-top">
                    <td className="py-1 pr-4 whitespace-nowrap">{l.log_date}</td>
                    <td className={`pr-4 ${l.mortality > 0 ? 'text-red-600 font-semibold' : ''}`}>{l.mortality}</td>
                    <td className="pr-4 whitespace-nowrap">{l.feed_given_kg != null ? `${Number(l.feed_given_kg)} kg` : '—'}</td>
                    <td className="pr-4 whitespace-nowrap">{l.water_given_liters != null ? `${Number(l.water_given_liters)} L` : '—'}</td>
                    <td className="text-gray-700">{l.health_notes || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// NEW BATCH (owner)
// ============================================

function nextBatchNumber(flocks) {
  const nums = flocks.map((f) => parseInt(String(f.batch_number).replace(/\D/g, ''), 10)).filter((n) => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `B${String(next).padStart(2, '0')}`;
}

function NewBatchModal({ farmId, houses, flocks, currentUser, onClose }) {
  const [form, setForm] = useState(() => ({
    batch_number: nextBatchNumber(flocks),
    bird_count: '',
    bird_type: 'Broiler',
    building_id: houses[0]?.building_id || '',
    start_date: today(),
    expected_harvest_date: addDays(today(), DEFAULT_GROWOUT_DAYS),
    chick_cost: '',
    payment_method: '',
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const house = houses.find((h) => h.building_id === form.building_id);
  const overCapacity = house?.capacity && Number(form.bird_count) > house.capacity;

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const { data: flock, error: flockError } = await supabase.from('flocks').insert({
      farm_id: farmId,
      building_id: form.building_id || null,
      batch_number: form.batch_number.trim(),
      bird_count: parseInt(form.bird_count, 10),
      bird_type: form.bird_type.trim() || 'Broiler',
      start_date: form.start_date,
      expected_harvest_date: form.expected_harvest_date || null,
      status: 'ACTIVE',
    }).select('flock_id').single();

    if (flockError) {
      setSaving(false);
      setError(flockError.message);
      return;
    }

    if (num(form.chick_cost) > 0) {
      const { error: txnError } = await supabase.from('transactions').insert({
        farm_id: farmId,
        flock_id: flock.flock_id,
        transaction_type: 'EXPENSE',
        category: 'Chicks',
        amount: num(form.chick_cost),
        description: `Batch ${form.batch_number}: ${form.bird_count} day-old chicks`,
        date: form.start_date,
        payment_method: form.payment_method || null,
        created_by: currentUser.id,
      });
      if (txnError) {
        setSaving(false);
        setError(`Batch saved, but the chick cost wasn't: ${txnError.message}. Add it on the Partner Dashboard.`);
        return;
      }
    }

    setSaving(false);
    onClose(true);
  };

  return (
    <Modal onClose={() => onClose(false)}>
      <h3 className="text-2xl font-bold mb-4">New Batch</h3>
      <ErrorBox message={error} />
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Batch number">
            <input className={inputClass} value={form.batch_number} onChange={set('batch_number')} required />
          </Field>
          <Field label="Chicks placed">
            <input className={inputClass} type="number" min="1" step="1" value={form.bird_count} onChange={set('bird_count')} required />
          </Field>
        </div>
        <Field label="House" hint={overCapacity ? `Over capacity (${house.capacity} birds)` : undefined}>
          <select className={inputClass} value={form.building_id} onChange={set('building_id')}>
            <option value="">None</option>
            {houses.map((h) => (
              <option key={h.building_id} value={h.building_id}>
                {h.building_name}{h.capacity ? ` (holds ${h.capacity})` : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Type">
          <input className={inputClass} value={form.bird_type} onChange={set('bird_type')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Arrival date">
            <input
              className={inputClass}
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({
                ...form,
                start_date: e.target.value,
                expected_harvest_date: addDays(e.target.value, DEFAULT_GROWOUT_DAYS),
              })}
              required
            />
          </Field>
          <Field label="Harvest due">
            <input className={inputClass} type="date" value={form.expected_harvest_date} onChange={set('expected_harvest_date')} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Chick cost (USD)" hint="Optional, booked as a batch expense">
            <input className={inputClass} type="number" min="0" step="0.01" value={form.chick_cost} onChange={set('chick_cost')} />
          </Field>
          <Field label="Paid with">
            <input className={inputClass} placeholder="Cash, EcoCash..." value={form.payment_method} onChange={set('payment_method')} />
          </Field>
        </div>
        <FormButtons saving={saving} onCancel={() => onClose(false)} label="Create Batch" />
      </form>
    </Modal>
  );
}

// ============================================
// DAILY LOG (owner + worker)
// ============================================

function DailyLogModal({ flock, currentUser, onClose }) {
  const [form, setForm] = useState({
    log_date: today(), mortality: '0', feed_given_kg: '', feed_item_id: '', water_given_liters: '', health_notes: '',
  });
  const [existing, setExisting] = useState(null);
  const [feeds, setFeeds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // Feed in stock to draw from. Default: the bag used in this batch's last log.
  useEffect(() => {
    (async () => {
      const [lv, last] = await Promise.all([
        supabase.from('inventory_levels').select('item_id, item_name, quantity_in_stock, unit_of_measure')
          .eq('farm_id', flock.farm_id).eq('item_type', 'FEED').order('item_name'),
        supabase.from('flock_daily_logs').select('feed_item_id').eq('flock_id', flock.flock_id)
          .order('log_date', { ascending: false }).limit(1),
      ]);
      const items = lv.data || [];
      setFeeds(items);
      const preferred = last.data?.[0]?.feed_item_id
        || items.find((i) => Number(i.quantity_in_stock) > 0)?.item_id || items[0]?.item_id || '';
      setForm((prev) => ({ ...prev, feed_item_id: prev.feed_item_id || preferred }));
    })();
  }, [flock.farm_id, flock.flock_id]);

  // If there's already a log for the chosen date, load it so saving corrects it.
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('flock_daily_logs')
        .select('mortality, feed_given_kg, feed_item_id, water_given_liters, health_notes')
        .eq('flock_id', flock.flock_id).eq('log_date', form.log_date).maybeSingle();
      setExisting(data || null);
      setForm((prev) => ({
        ...prev,
        mortality: data ? String(data.mortality ?? 0) : '0',
        feed_given_kg: data?.feed_given_kg != null ? String(Number(data.feed_given_kg)) : '',
        feed_item_id: data?.feed_item_id || prev.feed_item_id,
        water_given_liters: data?.water_given_liters != null ? String(Number(data.water_given_liters)) : '',
        health_notes: data?.health_notes || '',
      }));
    })();
  }, [flock.flock_id, form.log_date]);

  // Birds still alive if this log is saved (undo the old value when correcting).
  const aliveAfter = flock.birds_alive + (existing?.mortality || 0) - (parseInt(form.mortality, 10) || 0);

  const save = async (e) => {
    e.preventDefault();
    if (aliveAfter < 0) {
      setError(`Only ${flock.birds_alive + (existing?.mortality || 0)} birds are alive in this batch.`);
      return;
    }
    setSaving(true);
    setError('');
    const { error: saveError } = await supabase.from('flock_daily_logs').upsert({
      flock_id: flock.flock_id,
      log_date: form.log_date,
      mortality: parseInt(form.mortality, 10) || 0,
      feed_given_kg: num(form.feed_given_kg),
      feed_item_id: form.feed_item_id || null,
      water_given_liters: num(form.water_given_liters),
      health_notes: form.health_notes.trim() || null,
      birds_alive: aliveAfter,
      created_by: currentUser.id,
    }, { onConflict: 'flock_id,log_date' });
    setSaving(false);
    if (saveError) setError(saveError.message);
    else onClose(true);
  };

  return (
    <Modal onClose={() => onClose(false)}>
      <h3 className="text-2xl font-bold mb-1">Daily Log · Batch {flock.batch_number}</h3>
      <p className="text-gray-600 text-sm mb-4">
        {existing ? 'A log exists for this date; saving will correct it.' : `${flock.birds_alive} birds alive before today's deaths.`}
      </p>
      <ErrorBox message={error} />
      <form onSubmit={save} className="space-y-4">
        <Field label="Date">
          <input className={inputClass} type="date" max={today()} min={flock.start_date}
            value={form.log_date} onChange={set('log_date')} required />
        </Field>
        <Field label="Deaths" hint={`Birds alive after this: ${aliveAfter}`}>
          <input className={inputClass} type="number" min="0" step="1" inputMode="numeric"
            value={form.mortality} onChange={set('mortality')} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Feed given (kg)">
            <input className={inputClass} type="number" min="0" step="0.1" inputMode="decimal"
              value={form.feed_given_kg} onChange={set('feed_given_kg')} />
          </Field>
          <Field label="Water (litres)">
            <input className={inputClass} type="number" min="0" step="0.1" inputMode="decimal"
              value={form.water_given_liters} onChange={set('water_given_liters')} />
          </Field>
        </div>
        {feeds.length > 0 && (
          <Field label="Feed taken from" hint="Taken out of Inventory stock automatically">
            <select className={inputClass} value={form.feed_item_id} onChange={set('feed_item_id')}>
              <option value="">Not from stock</option>
              {feeds.map((i) => (
                <option key={i.item_id} value={i.item_id}>
                  {i.item_name} ({Number(Number(i.quantity_in_stock).toFixed(1))} {i.unit_of_measure || ''} left)
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Health notes">
          <textarea className={`${inputClass} h-20`} placeholder="Behaviour, droppings, vaccinations, medication..."
            value={form.health_notes} onChange={set('health_notes')} />
        </Field>
        <FormButtons saving={saving} onCancel={() => onClose(false)} label={existing ? 'Update Log' : 'Save Log'} />
      </form>
    </Modal>
  );
}

// ============================================
// SALE / HARVEST (owner)
// ============================================

function SaleModal({ flock, onClose }) {
  const [form, setForm] = useState({
    harvest_date: today(),
    birds_harvested: String(flock.birds_alive),
    total_weight_kg: '',
    sale_price_per_kg: '',
    buyer_name: '',
    payment_method: '',
    notes: '',
  });
  const [closeBatch, setCloseBatch] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const birds = parseInt(form.birds_harvested, 10) || 0;
  const weight = num(form.total_weight_kg) || 0;
  const revenue = Math.round(weight * (num(form.sale_price_per_kg) || 0) * 100) / 100;
  const remaining = flock.birds_alive - birds;

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const { error: rpcError } = await supabase.rpc('record_flock_harvest', {
      p_flock_id: flock.flock_id,
      p_harvest_date: form.harvest_date,
      p_birds_harvested: birds,
      p_total_weight_kg: weight,
      p_sale_price_per_kg: num(form.sale_price_per_kg) || 0,
      p_buyer_name: form.buyer_name.trim() || null,
      p_quality_grade: null,
      p_notes: form.notes.trim() || null,
      p_payment_method: form.payment_method.trim() || null,
      p_close_batch: closeBatch,
    });
    setSaving(false);
    if (rpcError) setError(rpcError.message);
    else onClose(true);
  };

  return (
    <Modal onClose={() => onClose(false)}>
      <h3 className="text-2xl font-bold mb-1">Record Sale · Batch {flock.batch_number}</h3>
      <p className="text-gray-600 text-sm mb-4">
        The income is added to the Partner Dashboard automatically.
      </p>
      <ErrorBox message={error} />
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input className={inputClass} type="date" value={form.harvest_date} onChange={set('harvest_date')} required />
          </Field>
          <Field label="Birds sold" hint={`${flock.birds_alive} alive`}>
            <input className={inputClass} type="number" min="1" max={flock.birds_alive} step="1"
              value={form.birds_harvested}
              onChange={(e) => {
                setForm({ ...form, birds_harvested: e.target.value });
                setCloseBatch(parseInt(e.target.value, 10) >= flock.birds_alive);
              }}
              required />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Total weight (kg)" hint={birds && weight ? `Avg ${(weight / birds).toFixed(2)} kg/bird` : undefined}>
            <input className={inputClass} type="number" min="0" step="0.1" inputMode="decimal"
              value={form.total_weight_kg} onChange={set('total_weight_kg')} required />
          </Field>
          <Field label="Price per kg (USD)">
            <input className={inputClass} type="number" min="0" step="0.01" inputMode="decimal"
              value={form.sale_price_per_kg} onChange={set('sale_price_per_kg')} required />
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
          <textarea className={`${inputClass} h-16`} value={form.notes} onChange={set('notes')} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={closeBatch} onChange={(e) => setCloseBatch(e.target.checked)} className="w-4 h-4" />
          Batch is finished{remaining > 0 ? ` (${remaining} birds would be left unsold)` : ''}
        </label>
        <div className="bg-green-50 border border-green-200 rounded p-3 text-sm">
          Sale total: <strong>{money(revenue)}</strong>
        </div>
        <FormButtons saving={saving} onCancel={() => onClose(false)} label="Record Sale" />
      </form>
    </Modal>
  );
}
