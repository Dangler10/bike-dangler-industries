// ============================================
// REPORT - weekly / monthly farm summary for the owner and partner.
// "Print / Save PDF" uses the browser's print dialog (print styles in index.css).
// ============================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { loadFarm, loadTasks, tasksForDay } from '../data';
import { ErrorBox, today, addDays, daysBetween, startOfWeek, money, prettyDate, MiniStat, SmallButton, inputClass } from '../components';

const monthStart = (iso) => `${iso.slice(0, 7)}-01`;
const monthEnd = (iso) => {
  const d = new Date(`${monthStart(iso)}T00:00:00`);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return d.toLocaleDateString('en-CA');
};

const PERIODS = {
  thisWeek: { label: 'This week', range: (t) => [startOfWeek(t), addDays(startOfWeek(t), 6)] },
  lastWeek: { label: 'Last week', range: (t) => [addDays(startOfWeek(t), -7), addDays(startOfWeek(t), -1)] },
  thisMonth: { label: 'This month', range: (t) => [monthStart(t), monthEnd(t)] },
  lastMonth: { label: 'Last month', range: (t) => { const p = addDays(monthStart(t), -1); return [monthStart(p), monthEnd(p)]; } },
};

const sumBy = (rows, key) => rows.reduce((s, r) => s + Number(r[key] || 0), 0);
const groupSum = (rows, keyFn, valFn) => {
  const m = new Map();
  rows.forEach((r) => m.set(keyFn(r), (m.get(keyFn(r)) || 0) + valFn(r)));
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

export default function ReportPage() {
  const t = today();
  const [period, setPeriod] = useState('lastWeek');
  const [custom, setCustom] = useState({ from: addDays(t, -6), to: t });
  const [d, setD] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const [from, to] = period === 'custom' ? [custom.from, custom.to] : PERIODS[period].range(t);

  useEffect(() => {
    if (!from || !to || from > to) return;
    setD(null);
    (async () => {
      try {
        const farm = await loadFarm();
        const id = farm.farm_id;
        const [txns, flocks, fLogs, fSales, plantings, cSales, equipment, services, stock, contrib, tasks] = await Promise.all([
          supabase.from('transactions').select('*').eq('farm_id', id).gte('date', from).lte('date', to),
          supabase.from('flock_summary').select('*').eq('farm_id', id),
          supabase.from('flock_daily_logs').select('flock_id, log_date, mortality, feed_given_kg').gte('log_date', from).lte('log_date', to),
          supabase.from('flock_harvesting').select('*').gte('harvest_date', from).lte('harvest_date', to),
          supabase.from('planting_summary').select('*').eq('farm_id', id),
          supabase.from('crop_harvests').select('*').gte('harvest_date', from).lte('harvest_date', to),
          supabase.from('equipment').select('equipment_id, equipment_name').eq('farm_id', id),
          supabase.from('maintenance_logs').select('*').gte('maintenance_date', from).lte('maintenance_date', to),
          supabase.from('inventory_levels').select('*').eq('farm_id', id),
          supabase.from('partner_contributions').select('*').eq('farm_id', id).gte('contribution_date', from).lte('contribution_date', to),
          loadTasks(id, from, to),
        ]);
        const err = [txns, flocks, fLogs].find((r) => r.error)?.error;
        if (err) throw new Error(err.message);
        setD({
          farm, txns: txns.data || [], flocks: flocks.data || [], fLogs: fLogs.data || [], fSales: fSales.data || [],
          plantings: plantings.data || [], cSales: cSales.data || [], equipment: equipment.data || [],
          services: services.data || [], stock: stock.data || [], contrib: contrib.data || [], tasks,
        });
      } catch (e) {
        setErrorMsg(e.message);
      }
    })();
  }, [from, to]);

  return (
    <div className="p-4 md:p-6 report">
      <div className="no-print flex flex-wrap gap-2 items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800 mr-auto">Report</h2>
        {Object.entries(PERIODS).map(([k, p]) => (
          <SmallButton key={k} tone={period === k ? 'green' : 'gray'} onClick={() => setPeriod(k)}>{p.label}</SmallButton>
        ))}
        <SmallButton tone={period === 'custom' ? 'green' : 'gray'} onClick={() => setPeriod('custom')}>Dates…</SmallButton>
        <SmallButton tone="blue" onClick={() => window.print()} disabled={!d}>Print / Save PDF</SmallButton>
      </div>
      {period === 'custom' && (
        <div className="no-print flex flex-wrap gap-3 mb-6 items-center">
          <input type="date" className={`${inputClass} w-auto`} value={custom.from} max={custom.to}
            onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
          <span>to</span>
          <input type="date" className={`${inputClass} w-auto`} value={custom.to} min={custom.from}
            onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
        </div>
      )}
      <ErrorBox message={errorMsg} />
      {!d ? (!errorMsg && <p className="text-gray-500">Loading...</p>) : <ReportBody d={d} from={from} to={to} />}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="bg-white rounded-lg shadow p-4 md:p-6 mb-6 break-inside-avoid">
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      {children}
    </section>
  );
}

function Table({ head, rows, empty }) {
  if (rows.length === 0) return <p className="text-gray-500 text-sm">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-gray-500">
          <tr>{head.map((h, i) => <th key={h} className={`py-1 pr-4 ${i > 0 ? 'text-right' : ''}`}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">
              {r.map((c, j) => <td key={j} className={`py-1 pr-4 ${j > 0 ? 'text-right' : ''}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportBody({ d, from, to }) {
  const income = d.txns.filter((x) => x.transaction_type === 'INCOME');
  const expenses = d.txns.filter((x) => x.transaction_type === 'EXPENSE');
  const net = sumBy(income, 'amount') - sumBy(expenses, 'amount');

  // Poultry: batches that were alive or sold during the period.
  const flockRows = d.flocks
    .filter((f) => f.start_date <= to && (f.status === 'ACTIVE' || (f.last_sale_date && f.last_sale_date >= from)))
    .map((f) => {
      const logs = d.fLogs.filter((l) => l.flock_id === f.flock_id);
      const sales = d.fSales.filter((s) => s.flock_id === f.flock_id);
      // Days the batch was on the farm within the period (up to today / last sale).
      const first = from > f.start_date ? from : f.start_date;
      const lastCandidates = [to, today(), f.status === 'ACTIVE' ? to : f.last_sale_date].filter(Boolean).sort();
      const expected = Math.max(0, daysBetween(first, lastCandidates[0]) + 1);
      return [
        f.batch_number,
        sumBy(logs, 'mortality'),
        `${sumBy(logs, 'feed_given_kg').toFixed(1)} kg`,
        `${logs.length} / ${expected}`,
        sumBy(sales, 'birds_harvested'),
        money(sumBy(sales, 'total_revenue')),
        f.status === 'ACTIVE' ? f.birds_alive : 'sold',
      ];
    });

  const cropRows = groupSum(d.cSales, (h) => d.plantings.find((p) => p.planting_id === h.planting_id)?.crop_name || 'Crop',
    (h) => Number(h.quantity_harvested_kg))
    .map(([crop, kg]) => {
      const rev = d.cSales.filter((h) => (d.plantings.find((p) => p.planting_id === h.planting_id)?.crop_name || 'Crop') === crop)
        .reduce((s, h) => s + Number(h.total_revenue || 0), 0);
      return [crop, `${kg.toFixed(1)} kg`, money(rev)];
    });

  // Tasks: scheduled vs ticked each day of the period (up to today).
  let scheduled = 0;
  let done = 0;
  for (let day = from; day <= to && day <= today(); day = addDays(day, 1)) {
    const list = tasksForDay(d.tasks.reminders, d.tasks.logFor, day, { carryOverdue: false });
    scheduled += list.length;
    done += list.filter((x) => x.log).length;
  }

  const eqName = (id) => d.equipment.find((e) => e.equipment_id === id)?.equipment_name;
  const services = d.services.filter((s) => eqName(s.equipment_id));
  const low = d.stock.filter((i) => i.is_low || Number(i.quantity_in_stock) <= 0);

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">{d.farm.name} · Farm report</h1>
        <p className="text-gray-600">{prettyDate(from)} – {prettyDate(to)} {from.slice(0, 4)} · printed {prettyDate(today())}</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MiniStat label="Income" value={money(sumBy(income, 'amount'))} />
        <MiniStat label="Expenses" value={money(sumBy(expenses, 'amount'))} tone="warn" />
        <MiniStat label="Profit" value={money(net)} tone={net >= 0 ? 'info' : 'bad'} />
        <MiniStat label="Tasks done" value={scheduled ? `${Math.round((100 * done) / scheduled)}%` : '—'} sub={`${done} of ${scheduled}`}
          tone={scheduled && done / scheduled < 0.8 ? 'warn' : 'ok'} />
      </div>

      <Section title="Money">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold mb-2">Income by category</h4>
            <Table head={['Category', 'Amount']} empty="No income in this period."
              rows={groupSum(income, (x) => x.category || 'Other', (x) => Number(x.amount)).map(([c, v]) => [c, money(v)])} />
          </div>
          <div>
            <h4 className="font-semibold mb-2">Expenses by category</h4>
            <Table head={['Category', 'Amount']} empty="No expenses in this period."
              rows={groupSum(expenses, (x) => x.category || 'Other', (x) => Number(x.amount)).map(([c, v]) => [c, money(v)])} />
          </div>
        </div>
        {d.contrib.length > 0 && (
          <p className="text-sm text-gray-700 mt-4">
            Partner capital received: <strong>{money(sumBy(d.contrib, 'contribution_amount'))}</strong> ({d.contrib.length} contribution{d.contrib.length === 1 ? '' : 's'}).
          </p>
        )}
      </Section>

      <Section title="Poultry">
        <Table head={['Batch', 'Deaths', 'Feed', 'Days logged', 'Birds sold', 'Sales', 'Alive now']} rows={flockRows}
          empty="No batches during this period." />
      </Section>

      <Section title="Crops">
        <Table head={['Crop', 'Harvested', 'Sales']} rows={cropRows} empty="Nothing harvested in this period." />
        <p className="text-sm text-gray-600 mt-3">
          Growing now: {d.plantings.filter((p) => ['NURSERY', 'GROWING', 'READY_FOR_HARVEST'].includes(p.current_status))
            .map((p) => `${p.crop_name} (${p.field_name})`).join(', ') || 'nothing'}.
        </p>
      </Section>

      <Section title="Equipment & stock">
        <Table head={['Service', 'Date', 'Cost']} empty="No services logged in this period."
          rows={services.map((s) => [`${eqName(s.equipment_id)}${s.maintenance_type ? `: ${s.maintenance_type}` : ''}`, s.maintenance_date, s.cost != null ? money(s.cost) : '—'])} />
        <p className="text-sm text-gray-700 mt-3">
          {low.length
            ? `Low or out of stock: ${low.map((i) => `${i.item_name} (${Number(Number(i.quantity_in_stock).toFixed(1))} ${i.unit_of_measure || ''})`).join(', ')}.`
            : 'No stock items are low.'}
        </p>
      </Section>
    </>
  );
}
