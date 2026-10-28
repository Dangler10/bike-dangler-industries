// ============================================
// DASHBOARD - live overview of the whole farm
// ============================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { loadFarm, loadTasks, tasksForDay, sortTasks, maintenanceStatus, toggleTaskDone } from '../data';
import { WeekBoard } from '../taskViews';
import { ErrorBox, today, addDays, startOfWeek, money, MiniStat, Badge } from '../components';

export default function DashboardPage({ currentUser, role, onNavigate }) {
  const seesMoney = role !== 'WORKER';
  const [d, setD] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [busyKey, setBusyKey] = useState(null);
  const t = today();
  const monday = startOfWeek(t);
  const canTick = role === 'OWNER' || role === 'WORKER';

  // Tick / un-tick a task from the week board, then refresh.
  const toggleTask = async (task, iso) => {
    setBusyKey(`${task.reminder_id}|${iso}`);
    setErrorMsg('');
    const message = await toggleTaskDone(task, iso, currentUser.id);
    setBusyKey(null);
    if (message) setErrorMsg(message);
    else setReloadKey((k) => k + 1);
  };

  useEffect(() => {
    (async () => {
      try {
        const farm = await loadFarm();
        const id = farm.farm_id;
        const [flocks, plantings, equipment, stock, tasks, txns, flockLogs, cropLogs] = await Promise.all([
          supabase.from('flock_summary').select('*').eq('farm_id', id).eq('status', 'ACTIVE'),
          supabase.from('planting_summary').select('*').eq('farm_id', id),
          supabase.from('equipment').select('*').eq('farm_id', id),
          supabase.from('inventory_levels').select('*').eq('farm_id', id),
          loadTasks(id, monday, addDays(monday, 6)),
          seesMoney
            ? supabase.from('transactions').select('*').eq('farm_id', id).order('date', { ascending: false }).order('created_at', { ascending: false })
            : Promise.resolve({ data: [] }),
          supabase.from('flock_daily_logs').select('log_id, flock_id, log_date, mortality, feed_given_kg, created_at')
            .order('created_at', { ascending: false }).limit(5),
          supabase.from('crop_daily_logs').select('log_id, planting_id, log_date, health_status, pest_observations, created_at')
            .order('created_at', { ascending: false }).limit(5),
        ]);
        const err = [flocks, plantings, equipment, stock].find((r) => r.error)?.error;
        if (err) throw new Error(err.message);
        setD({
          farm,
          flocks: flocks.data || [],
          plantings: (plantings.data || []),
          equipment: (equipment.data || []).map((e) => ({ ...e, ms: maintenanceStatus(e) })),
          stock: stock.data || [],
          weekTasks: tasks,
          todayTasks: sortTasks(tasksForDay(tasks.reminders, tasks.logFor, t)),
          txns: txns.data || [],
          flockLogs: flockLogs.data || [],
          cropLogs: cropLogs.data || [],
        });
      } catch (e) {
        setErrorMsg(e.message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, seesMoney, reloadKey]);

  const name = currentUser?.email?.split('@')[0];
  if (!d) {
    return (
      <div className="p-4 md:p-6">
        <h2 className="text-3xl font-bold text-gray-800 mb-6">Welcome back, {name}</h2>
        <ErrorBox message={errorMsg} />
        {!errorMsg && <p className="text-gray-500">Loading...</p>}
      </div>
    );
  }

  const birds = d.flocks.reduce((s, f) => s + f.birds_alive, 0);
  const flocksNotLogged = d.flocks.filter((f) => f.age_days >= 0 && f.last_log_date !== t);
  const growing = d.plantings.filter((p) => ['NURSERY', 'GROWING', 'READY_FOR_HARVEST'].includes(p.current_status));
  const harvestSoon = growing.filter((p) => p.days_to_harvest != null && p.days_to_harvest <= 7);
  const eqAlerts = d.equipment.filter((e) => ['Overdue', 'Broken', 'Due this week'].includes(e.ms.label));
  const lowStock = d.stock.filter((i) => i.is_low || Number(i.quantity_in_stock) <= 0);
  const tasksLeft = d.todayTasks.filter((x) => !x.log);
  const month = t.slice(0, 7);
  const monthRows = d.txns.filter((x) => x.date.startsWith(month));
  const sum = (rows, type) => rows.filter((x) => x.transaction_type === type).reduce((s, x) => s + Number(x.amount), 0);
  const monthNet = sum(monthRows, 'INCOME') - sum(monthRows, 'EXPENSE');
  const allNet = sum(d.txns, 'INCOME') - sum(d.txns, 'EXPENSE');

  // Things that need doing, most urgent first.
  const alerts = [
    ...flocksNotLogged.map((f) => ({ tone: 'orange', text: `Batch ${f.batch_number} not logged today`, page: 'poultry' })),
    ...d.flocks.filter((f) => f.mortality_pct >= 5).map((f) => ({ tone: 'red', text: `Batch ${f.batch_number}: ${f.mortality_pct}% deaths so far`, page: 'poultry' })),
    ...d.flocks.filter((f) => f.expected_harvest_date && f.expected_harvest_date <= t).map((f) => ({ tone: 'blue', text: `Batch ${f.batch_number} is due for sale`, page: 'poultry' })),
    ...eqAlerts.map((e) => ({ tone: e.ms.tone, text: `${e.equipment_name}: ${e.ms.label.toLowerCase()}`, page: 'equipment' })),
    ...lowStock.map((i) => ({
      tone: Number(i.quantity_in_stock) <= 0 ? 'red' : 'orange',
      text: `${i.item_name}: ${Number(i.quantity_in_stock) <= 0 ? 'out of stock' : `low (${Number(Number(i.quantity_in_stock).toFixed(1))} ${i.unit_of_measure || ''} left)`}`,
      page: 'inventory',
    })),
    ...harvestSoon.map((p) => ({ tone: 'blue', text: `${p.crop_name} (${p.field_name}) ready ${p.days_to_harvest <= 0 ? 'now' : `in ${p.days_to_harvest} days`}`, page: 'crops' })),
  ];

  const flockName = (id) => d.flocks.find((f) => f.flock_id === id)?.batch_number;
  const cropName = (id) => d.plantings.find((p) => p.planting_id === id)?.crop_name;
  const activity = [
    ...d.flockLogs.map((l) => ({
      at: l.created_at, text: `Batch ${flockName(l.flock_id) || ''} logged for ${l.log_date}: ${l.mortality} deaths${l.feed_given_kg ? `, ${Number(l.feed_given_kg)} kg feed` : ''}`,
    })),
    ...d.cropLogs.map((l) => ({
      at: l.created_at, text: `${cropName(l.planting_id) || 'Crop'} logged for ${l.log_date}${l.health_status ? `: ${l.health_status.toLowerCase()}` : ''}${l.pest_observations ? ` (${l.pest_observations})` : ''}`,
    })),
    ...d.txns.slice(0, 5).map((x) => ({
      at: x.created_at, text: `${x.transaction_type === 'INCOME' ? '+' : '-'}${money(x.amount)} ${x.description || x.category || ''}`,
    })),
  ].sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 6);

  return (
    <div className="p-4 md:p-6">
      <header className="mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Welcome back, {name}</h2>
        <p className="text-gray-600">{d.farm.name} · {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <button className="text-left" onClick={() => onNavigate('tasks')}>
          <MiniStat label="Today's tasks" value={`${d.todayTasks.length - tasksLeft.length} / ${d.todayTasks.length} done`}
            tone={tasksLeft.length ? 'warn' : 'ok'} sub={tasksLeft.length ? `${tasksLeft.length} left` : 'All done'} />
        </button>
        <button className="text-left" onClick={() => onNavigate('poultry')}>
          <MiniStat label="Birds on farm" value={birds.toLocaleString()} tone="info"
            sub={`${d.flocks.length} active batch${d.flocks.length === 1 ? '' : 'es'}`} />
        </button>
        <button className="text-left" onClick={() => onNavigate('crops')}>
          <MiniStat label="Crops growing" value={growing.length} tone="info"
            sub={harvestSoon.length ? `${harvestSoon.length} to harvest this week` : 'None due this week'} />
        </button>
        {seesMoney ? (
          <button className="text-left" onClick={() => onNavigate('partner')}>
            <MiniStat label="Profit this month" value={money(monthNet)} tone={monthNet >= 0 ? 'ok' : 'bad'} sub={`All time ${money(allNet)}`} />
          </button>
        ) : (
          <button className="text-left" onClick={() => onNavigate('equipment')}>
            <MiniStat label="Equipment alerts" value={eqAlerts.length} tone={eqAlerts.length ? 'bad' : 'ok'} />
          </button>
        )}
      </div>

      <WeekBoard
        monday={monday}
        reminders={d.weekTasks.reminders}
        logFor={d.weekTasks.logFor}
        canTick={canTick}
        busyKey={busyKey}
        onToggle={toggleTask}
        onOpenTasks={() => onNavigate('tasks')}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-4 md:p-6">
          <h3 className="text-xl font-bold mb-4">Needs attention</h3>
          {alerts.length === 0 ? <p className="text-gray-500">Nothing urgent. 👍</p> : (
            <div className="space-y-2">
              {alerts.map((a, i) => (
                <button key={i} onClick={() => onNavigate(a.page)}
                  className="w-full text-left p-3 border border-gray-200 hover:bg-gray-50 rounded flex items-center gap-3">
                  <Badge tone={a.tone}>!</Badge>
                  <span className="font-medium text-gray-800 flex-1">{a.text}</span>
                  <span className="text-gray-400">→</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-4 md:p-6">
          <h3 className="text-xl font-bold mb-4">Still to do today</h3>
          {tasksLeft.length === 0 ? (
            <p className="text-gray-500">{d.todayTasks.length ? 'Everything is done for today.' : 'No tasks set up yet.'}</p>
          ) : (
            <div className="space-y-2">
              {tasksLeft.slice(0, 6).map((x) => (
                <button key={x.reminder_id} onClick={() => onNavigate('tasks')}
                  className="w-full text-left p-3 border border-gray-200 hover:bg-gray-50 rounded flex items-center gap-3">
                  <span className="text-sm text-gray-500 w-12">{x.due_time ? String(x.due_time).slice(0, 5) : ''}</span>
                  <span className="font-medium text-gray-800 flex-1">{x.reminder_title}</span>
                  {x.overdue && <Badge tone="red">Overdue</Badge>}
                </button>
              ))}
              {tasksLeft.length > 6 && <p className="text-sm text-gray-500">+{tasksLeft.length - 6} more</p>}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-4 md:p-6 lg:col-span-2">
          <h3 className="text-xl font-bold mb-4">Recent activity</h3>
          {activity.length === 0 ? <p className="text-gray-500">Nothing logged yet.</p> : (
            <div className="space-y-3">
              {activity.map((a, i) => (
                <div key={i} className="border-l-2 border-green-300 pl-4 py-1">
                  <p className="font-medium text-gray-800">{a.text}</p>
                  <p className="text-sm text-gray-500">{new Date(a.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
