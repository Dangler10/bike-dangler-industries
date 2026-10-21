// ============================================
// ACTIVITY LOG (owners) - every add / change / delete, who and when.
// Written by database triggers (supabase/06_investors_and_audit.sql);
// read-only here, and nobody can edit or remove entries from the app.
// ============================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { ErrorBox, Badge, SmallButton, Empty, inputClass, today, addDays } from '../components';

const TABLE_LABELS = {
  users: 'Team member', farms: 'Farm', fields: 'Field', buildings: 'Building',
  flocks: 'Broiler batch', flock_daily_logs: 'Poultry daily log', flock_harvesting: 'Broiler sale',
  crop_varieties: 'Crop type', plantings: 'Planting', crop_daily_logs: 'Crop daily log',
  crop_harvests: 'Crop harvest', crop_calendar: 'Crop calendar', seasonal_plans: 'Seasonal plan',
  inventory_items: 'Stock item', inventory_stock: 'Stock level', inventory_usage: 'Stock use',
  equipment: 'Equipment', maintenance_logs: 'Equipment service', reminders: 'Task',
  task_logs: 'Task ticked', transactions: 'Money entry', partner_contributions: 'Capital contribution',
  financial_summaries: 'Financial summary',
};
const ACTION = {
  INSERT: { label: 'Added', tone: 'green' },
  UPDATE: { label: 'Changed', tone: 'blue' },
  DELETE: { label: 'Deleted', tone: 'red' },
};
// Columns that are internal links/ids, not worth showing in a summary.
const HIDDEN = /(^|_)id$|created_at|updated_at|last_updated|created_by|completed_by|used_by/;
// The most telling field per table, for a one-line summary.
const NAME_FIELDS = ['batch_number', 'crop_name', 'field_name', 'building_name', 'equipment_name', 'item_name',
  'reminder_title', 'description', 'category', 'email', 'name', 'log_date', 'harvest_date', 'maintenance_date'];
const PAGE = 100;

const show = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

function summary(e) {
  const row = e.new_data || e.old_data || {};
  const name = NAME_FIELDS.map((f) => row[f]).find((v) => v !== null && v !== undefined && v !== '');
  const amount = row.amount ?? row.contribution_amount ?? row.total_revenue;
  return [name, amount != null && `$${Number(amount).toFixed(2)}`].filter(Boolean).join(' · ');
}

export default function AuditPage() {
  const [entries, setEntries] = useState(null);
  const [people, setPeople] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [filters, setFilters] = useState({ table: '', user: '', from: addDays(today(), -30) });
  const [limit, setLimit] = useState(PAGE);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    supabase.from('users').select('user_id, email, full_name').order('email')
      .then(({ data }) => setPeople(data || []));
  }, []);

  useEffect(() => {
    (async () => {
      setErrorMsg('');
      let q = supabase.from('audit_log').select('*')
        .gte('changed_at', `${filters.from}T00:00:00`)
        .order('changed_at', { ascending: false }).limit(limit + 1);
      if (filters.table) q = q.eq('table_name', filters.table);
      if (filters.user === 'system') q = q.is('user_id', null);
      else if (filters.user) q = q.eq('user_id', filters.user);
      const { data, error } = await q;
      if (error) {
        setErrorMsg(error.message.includes('audit_log')
          ? 'The activity log isn\'t set up yet. Run supabase/06_investors_and_audit.sql in Supabase.'
          : error.message);
        setEntries([]);
      } else {
        setEntries(data || []);
      }
    })();
  }, [filters, limit]);

  const set = (k) => (ev) => { setLimit(PAGE); setFilters({ ...filters, [k]: ev.target.value }); };
  const who = (e) => (e.user_id ? (people.find((p) => p.user_id === e.user_id)?.full_name || e.user_email || 'Unknown user') : 'System (SQL editor)');
  const shown = (entries || []).slice(0, limit);

  return (
    <div className="p-4 md:p-6">
      <h2 className="text-3xl font-bold text-gray-800 mb-2">Activity log</h2>
      <p className="text-gray-600 mb-6">Every change anyone makes is recorded here automatically. Entries can't be edited or deleted.</p>
      <ErrorBox message={errorMsg} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <select className={inputClass} value={filters.table} onChange={set('table')} aria-label="What">
          <option value="">Everything</option>
          {Object.entries(TABLE_LABELS).sort((a, b) => a[1].localeCompare(b[1]))
            .map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className={inputClass} value={filters.user} onChange={set('user')} aria-label="Who">
          <option value="">Everyone</option>
          {people.map((p) => <option key={p.user_id} value={p.user_id}>{p.full_name || p.email}</option>)}
          <option value="system">System (SQL editor)</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          Since
          <input type="date" className={inputClass} value={filters.from} max={today()} onChange={set('from')} />
        </label>
      </div>

      {!entries ? <p className="text-gray-500">Loading...</p> : shown.length === 0 ? (
        <Empty>No changes recorded for these filters.</Empty>
      ) : (
        <div className="bg-white rounded-lg shadow divide-y">
          {shown.map((e) => {
            const fields = (e.changed_fields || []).filter((f) => !HIDDEN.test(f));
            const open = openId === e.audit_id;
            return (
              <div key={e.audit_id} className="p-4">
                <div className="flex flex-wrap items-start gap-2 justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={ACTION[e.action]?.tone}>{ACTION[e.action]?.label || e.action}</Badge>
                      <span className="font-semibold text-gray-800">{TABLE_LABELS[e.table_name] || e.table_name}</span>
                      {summary(e) && <span className="text-gray-700 truncate">{summary(e)}</span>}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {who(e)} · {new Date(e.changed_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </p>
                    {e.action === 'UPDATE' && fields.length > 0 && (
                      <ul className="text-sm mt-2 space-y-0.5">
                        {fields.map((f) => (
                          <li key={f}>
                            <span className="text-gray-600">{f.replace(/_/g, ' ')}:</span>{' '}
                            <span className="line-through text-red-600">{show(e.old_data?.[f])}</span>{' → '}
                            <span className="text-green-700">{show(e.new_data?.[f])}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <SmallButton onClick={() => setOpenId(open ? null : e.audit_id)}>{open ? 'Hide' : 'Details'}</SmallButton>
                </div>
                {open && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead className="text-left text-gray-500">
                        <tr><th className="pr-4 py-1">Field</th><th className="pr-4">Before</th><th>After</th></tr>
                      </thead>
                      <tbody>
                        {Object.keys({ ...(e.old_data || {}), ...(e.new_data || {}) }).sort().map((f) => (
                          <tr key={f} className={`border-t ${(e.changed_fields || []).includes(f) ? 'bg-yellow-50' : ''}`}>
                            <td className="pr-4 py-1 text-gray-600 whitespace-nowrap">{f}</td>
                            <td className="pr-4 break-all">{e.old_data ? show(e.old_data[f]) : ''}</td>
                            <td className="break-all">{e.new_data ? show(e.new_data[f]) : ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {(entries || []).length > limit && (
        <button onClick={() => setLimit(limit + PAGE)} className="mt-6 text-green-700 font-semibold">Show older changes</button>
      )}
    </div>
  );
}
