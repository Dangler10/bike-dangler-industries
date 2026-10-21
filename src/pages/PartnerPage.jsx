// ============================================
// PARTNER DASHBOARD - capital, profit share, ROI, transactions
// Needs supabase/03_operations.sql (partner_position view).
// ============================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { loadFarm } from '../data';
import {
  Modal, ErrorBox, Field, FormButtons, inputClass, today, money, MONTHS, toDate,
  PageHeader, PrimaryButton, SmallButton, MiniStat, Badge, Tabs, Empty,
} from '../components';

const monthKey = (iso) => iso.slice(0, 7);
const monthLabel = (key) => `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;

// Average monthly profit share since the first transaction, and when the
// partner's capital will be paid back at that rate.
function breakeven(p) {
  const contributed = Number(p.total_contributed);
  const share = Number(p.profit_share);
  if (contributed <= 0) return { text: 'No capital recorded yet' };
  if (share >= contributed) return { text: 'Capital recovered', tone: 'ok' };
  if (!p.first_transaction_date || share <= 0) return { text: 'Not profitable yet', tone: 'warn' };
  const start = toDate(p.first_transaction_date);
  const now = toDate(today());
  const months = Math.max(1, (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth() + 1);
  const perMonth = share / months;
  const monthsLeft = Math.ceil((contributed - share) / perMonth);
  const when = new Date(now.getFullYear(), now.getMonth() + monthsLeft, 1);
  return {
    text: `~${monthsLeft} month${monthsLeft === 1 ? '' : 's'} (${MONTHS[when.getMonth()]} ${when.getFullYear()})`,
    sub: `at ${money(perMonth)}/month so far`,
    tone: 'info',
  };
}

export default function PartnerPage({ currentUser, role }) {
  const isOwner = role === 'OWNER';
  const [farmId, setFarmId] = useState(null);
  const [positions, setPositions] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [flocks, setFlocks] = useState([]);
  const [plantings, setPlantings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [modal, setModal] = useState(null); // 'txn' | 'contribution'
  const [tab, setTab] = useState('overview');
  const [txnFilter, setTxnFilter] = useState('ALL');

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const farm = await loadFarm();
      setFarmId(farm.farm_id);
      const [pos, con, txn, fl, pl] = await Promise.all([
        supabase.from('partner_position').select('*'),
        supabase.from('partner_contributions').select('*').eq('farm_id', farm.farm_id)
          .order('contribution_date', { ascending: false }),
        supabase.from('transactions').select('*').eq('farm_id', farm.farm_id)
          .order('date', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('flocks').select('flock_id, batch_number, status').eq('farm_id', farm.farm_id)
          .order('start_date', { ascending: false }),
        supabase.from('planting_summary').select('planting_id, crop_name, field_name, current_status')
          .eq('farm_id', farm.farm_id).order('planting_date', { ascending: false }),
      ]);
      const firstError = [pos, con, txn].find((r) => r.error)?.error;
      if (firstError) setErrorMsg(firstError.message);
      setPositions(pos.data || []);
      setContributions(con.data || []);
      setTransactions(txn.data || []);
      setFlocks(fl.data || []);
      setPlantings(pl.data || []);
    } catch (e) {
      setErrorMsg(e.message);
    }
    setLoading(false);
  };

  const closeModal = (changed) => {
    setModal(null);
    if (changed) load();
  };

  // Deleting a sale also removes its harvest record; deleting a delivery
  // also takes that stock back out (see supabase/04_undo_and_reports.sql).
  const deleteTxn = async (t) => {
    const extra = t.flock_harvest_id ? '\n\nThis also removes the sale from the batch (birds count as unsold again).'
      : t.crop_harvest_id ? '\n\nThis also removes the harvest from the crop.'
        : t.inventory_item_id && t.stock_quantity ? `\n\nThis also takes ${Number(t.stock_quantity)} back out of stock.` : '';
    if (!window.confirm(`Delete "${t.description || t.category || t.transaction_type}" (${money(t.amount)})?${extra}`)) return;
    const { error } = await supabase.rpc('delete_transaction', { p_transaction_id: t.transaction_id });
    if (error) setErrorMsg(error.message);
    else load();
  };

  const deleteContribution = async (c) => {
    if (!window.confirm(`Delete contribution of ${money(c.contribution_amount)} on ${c.contribution_date}?`)) return;
    const { error } = await supabase.from('partner_contributions').delete().eq('contribution_id', c.contribution_id);
    if (error) setErrorMsg(error.message);
    else load();
  };

  // ---- totals ----
  const sum = (rows, type) => rows.filter((t) => t.transaction_type === type).reduce((s, t) => s + Number(t.amount), 0);
  const income = sum(transactions, 'INCOME');
  const expenses = sum(transactions, 'EXPENSE');
  const thisMonth = transactions.filter((t) => monthKey(t.date) === monthKey(today()));
  const monthIncome = sum(thisMonth, 'INCOME');
  const monthExpenses = sum(thisMonth, 'EXPENSE');

  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = toDate(today());
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    months.push(d.toLocaleDateString('en-CA').slice(0, 7));
  }
  const monthly = months.map((m) => {
    const rows = transactions.filter((t) => monthKey(t.date) === m);
    return { m, income: sum(rows, 'INCOME'), expenses: sum(rows, 'EXPENSE') };
  });

  // A partner sees their own position; the owner sees every partner's.
  const shownPositions = role === 'PARTNER' ? positions.filter((p) => p.partner_id === currentUser.id) : positions;
  const shownTxns = txnFilter === 'ALL' ? transactions : transactions.filter((t) => t.transaction_type === txnFilter);
  const label = (t) => {
    const flock = t.flock_id && flocks.find((f) => f.flock_id === t.flock_id);
    const pl = t.planting_id && plantings.find((p) => p.planting_id === t.planting_id);
    return flock ? `Batch ${flock.batch_number}` : pl ? `${pl.crop_name} (${pl.field_name})` : null;
  };

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Partner Dashboard">
        {isOwner && (
          <>
            <PrimaryButton onClick={() => setModal('contribution')} disabled={!farmId}>+ Capital</PrimaryButton>
            <PrimaryButton onClick={() => setModal('txn')} disabled={!farmId}>+ Expense / Income</PrimaryButton>
          </>
        )}
      </PageHeader>

      <ErrorBox message={errorMsg} />

      {loading ? <p className="text-gray-500">Loading...</p> : (
        <>
          {shownPositions.length === 0 ? (
            <Empty>
              No investors yet.{isOwner && ' Tick "Investor" for someone on the Team page, then record their capital here.'}
            </Empty>
          ) : shownPositions.map((p) => {
            const be = breakeven(p);
            return (
              <div key={p.partner_id} className="bg-white rounded-lg shadow p-4 md:p-6 mb-6">
                <div className="flex flex-wrap justify-between items-baseline gap-2 mb-4">
                  <h3 className="text-xl font-bold">
                    {p.partner_id === currentUser.id ? 'Your position' : p.partner_name}
                  </h3>
                  <span className="text-sm text-gray-600">{Number(p.profit_share_pct)}% of farm profit</span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <MiniStat label="Capital put in" value={money(p.total_contributed)}
                    sub={`${p.contributions} contribution${Number(p.contributions) === 1 ? '' : 's'}`} tone="info" />
                  <MiniStat label="Share of profit" value={money(p.profit_share)}
                    sub={`${Number(p.profit_share_pct)}% of ${money(p.net_profit)}`}
                    tone={Number(p.profit_share) >= 0 ? 'ok' : 'bad'} />
                  <MiniStat label="Return (ROI)" value={p.roi_pct === null ? '—' : `${Number(p.roi_pct)}%`}
                    sub="share ÷ capital" tone={Number(p.roi_pct) >= 0 ? 'ok' : 'bad'} />
                  <MiniStat label="Capital paid back" value={be.text} sub={be.sub} tone={be.tone || 'warn'} />
                </div>
              </div>
            );
          })}

          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[['overview', 'Money summary'], ['transactions', `Transactions (${transactions.length})`], ['capital', `Capital (${contributions.length})`]]}
          />

          {tab === 'overview' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <MiniStat label="Income (all time)" value={money(income)} sub={`This month ${money(monthIncome)}`} />
                <MiniStat label="Expenses (all time)" value={money(expenses)} sub={`This month ${money(monthExpenses)}`} tone="warn" />
                <MiniStat label="Net profit (all time)" value={money(income - expenses)}
                  sub={`This month ${money(monthIncome - monthExpenses)}`} tone={income - expenses >= 0 ? 'info' : 'bad'} />
              </div>
              <div className="bg-white rounded-lg shadow p-4 md:p-6 overflow-x-auto">
                <h3 className="text-lg font-bold mb-3">Last 6 months</h3>
                <table className="w-full text-sm">
                  <thead className="text-left text-gray-500">
                    <tr><th className="py-1 pr-4">Month</th><th className="pr-4 text-right">Income</th><th className="pr-4 text-right">Expenses</th><th className="text-right">Profit</th></tr>
                  </thead>
                  <tbody>
                    {monthly.map((r) => (
                      <tr key={r.m} className="border-t">
                        <td className="py-2 pr-4">{monthLabel(r.m)}</td>
                        <td className="pr-4 text-right text-green-700">{money(r.income)}</td>
                        <td className="pr-4 text-right text-red-600">{money(r.expenses)}</td>
                        <td className={`text-right font-semibold ${r.income - r.expenses >= 0 ? 'text-gray-800' : 'text-red-600'}`}>
                          {money(r.income - r.expenses)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'transactions' && (
            <div className="bg-white rounded-lg shadow p-4 md:p-6">
              <div className="flex gap-2 mb-4">
                {['ALL', 'INCOME', 'EXPENSE'].map((f) => (
                  <SmallButton key={f} tone={txnFilter === f ? 'green' : 'gray'} onClick={() => setTxnFilter(f)}>
                    {f === 'ALL' ? 'All' : f === 'INCOME' ? 'Income' : 'Expenses'}
                  </SmallButton>
                ))}
              </div>
              {shownTxns.length === 0 ? <p className="text-gray-500">No transactions yet.</p> : (
                <div className="divide-y">
                  {shownTxns.map((t) => (
                    <div key={t.transaction_id} className="py-3 flex justify-between items-start gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800">{t.description || t.category || t.transaction_type}</p>
                        <p className="text-sm text-gray-600">
                          {t.date}{t.category ? ` · ${t.category}` : ''}{t.payment_method ? ` · ${t.payment_method}` : ''}
                        </p>
                        {label(t) && <Badge tone="blue">{label(t)}</Badge>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`font-bold ${t.transaction_type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
                          {t.transaction_type === 'INCOME' ? '+' : '-'}{money(t.amount)}
                        </p>
                        {isOwner && (
                          <button onClick={() => deleteTxn(t)} className="text-xs text-gray-500 hover:text-red-600 mt-1">Delete</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'capital' && (
            <div className="bg-white rounded-lg shadow p-4 md:p-6">
              {contributions.length === 0 ? <p className="text-gray-500">No capital recorded yet.</p> : (
                <div className="divide-y">
                  {contributions.map((c) => {
                    const p = positions.find((x) => x.partner_id === c.partner_id);
                    return (
                      <div key={c.contribution_id} className="py-3 flex justify-between items-start gap-3">
                        <div>
                          <p className="font-semibold text-gray-800">{c.description || `${c.contribution_type || 'Capital'} contribution`}</p>
                          <p className="text-sm text-gray-600">
                            {c.contribution_date} · {p?.partner_name || 'Partner'}{c.contribution_type ? ` · ${c.contribution_type}` : ''}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-blue-700">{money(c.contribution_amount)}</p>
                          {isOwner && (
                            <button onClick={() => deleteContribution(c)} className="text-xs text-gray-500 hover:text-red-600 mt-1">Delete</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {modal === 'txn' && (
        <TransactionModal farmId={farmId} flocks={flocks} plantings={plantings} currentUser={currentUser} onClose={closeModal} />
      )}
      {modal === 'contribution' && (
        <ContributionModal farmId={farmId} partners={positions} onClose={closeModal} />
      )}
    </div>
  );
}

function TransactionModal({ farmId, flocks, plantings, currentUser, onClose }) {
  const [form, setForm] = useState({
    transaction_type: 'EXPENSE', category: '', amount: '', description: '',
    date: today(), payment_method: '', link: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const [kind, id] = form.link.split(':');
    const { error: saveError } = await supabase.from('transactions').insert({
      farm_id: farmId,
      transaction_type: form.transaction_type,
      category: form.category.trim() || null,
      amount: parseFloat(form.amount),
      description: form.description.trim() || null,
      date: form.date,
      payment_method: form.payment_method.trim() || null,
      flock_id: kind === 'flock' ? id : null,
      planting_id: kind === 'planting' ? id : null,
      created_by: currentUser.id,
    });
    setSaving(false);
    if (saveError) setError(saveError.message);
    else onClose(true);
  };

  return (
    <Modal onClose={() => onClose(false)}>
      <h3 className="text-2xl font-bold mb-4">Add Expense / Income</h3>
      <ErrorBox message={error} />
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select className={inputClass} value={form.transaction_type} onChange={set('transaction_type')}>
              <option value="EXPENSE">Expense</option>
              <option value="INCOME">Income</option>
            </select>
          </Field>
          <Field label="Amount (USD)">
            <input className={inputClass} type="number" step="0.01" min="0.01" value={form.amount} onChange={set('amount')} required />
          </Field>
        </div>
        <Field label="Category">
          <input className={inputClass} list="txn-categories" placeholder="Feed, Seeds, Labour, Transport..." value={form.category} onChange={set('category')} />
          <datalist id="txn-categories">
            {['Feed', 'Chicks', 'Vaccines', 'Seeds', 'Fertilizer', 'Chemicals', 'Labour', 'Transport', 'Electricity', 'Water', 'Maintenance', 'Broiler sales', 'Crop sales'].map((c) => <option key={c} value={c} />)}
          </datalist>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input className={inputClass} type="date" value={form.date} onChange={set('date')} required />
          </Field>
          <Field label="Paid with">
            <input className={inputClass} placeholder="Cash, EcoCash..." value={form.payment_method} onChange={set('payment_method')} />
          </Field>
        </div>
        <Field label="For" hint="Tie it to a batch or crop to see that batch's / crop's profit">
          <select className={inputClass} value={form.link} onChange={set('link')}>
            <option value="">The whole farm</option>
            {flocks.length > 0 && (
              <optgroup label="Broiler batches">
                {flocks.map((f) => <option key={f.flock_id} value={`flock:${f.flock_id}`}>Batch {f.batch_number}{f.status !== 'ACTIVE' ? ` (${f.status.toLowerCase()})` : ''}</option>)}
              </optgroup>
            )}
            {plantings.length > 0 && (
              <optgroup label="Crops">
                {plantings.map((p) => <option key={p.planting_id} value={`planting:${p.planting_id}`}>{p.crop_name} - {p.field_name}{p.current_status === 'HARVESTED' ? ' (harvested)' : ''}</option>)}
              </optgroup>
            )}
          </select>
        </Field>
        <Field label="Description">
          <textarea className={`${inputClass} h-20`} value={form.description} onChange={set('description')} />
        </Field>
        <FormButtons saving={saving} onCancel={() => onClose(false)} />
      </form>
    </Modal>
  );
}

function ContributionModal({ farmId, partners, onClose }) {
  const [form, setForm] = useState({
    partner_id: partners[0]?.partner_id || '', contribution_amount: '', contribution_date: today(),
    contribution_type: 'CASH', description: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const { error: saveError } = await supabase.from('partner_contributions').insert({
      farm_id: farmId,
      partner_id: form.partner_id,
      contribution_amount: parseFloat(form.contribution_amount),
      contribution_date: form.contribution_date,
      contribution_type: form.contribution_type,
      description: form.description.trim() || null,
    });
    setSaving(false);
    if (saveError) setError(saveError.message);
    else onClose(true);
  };

  return (
    <Modal onClose={() => onClose(false)}>
      <h3 className="text-2xl font-bold mb-1">Record Capital</h3>
      <p className="text-sm text-gray-600 mb-4">Money or goods a partner put into the farm. This is their investment, not farm income.</p>
      <ErrorBox message={error} />
      {partners.length === 0 ? (
        <p className="text-gray-700">No partners yet. Give someone the PARTNER role on the Team page first.</p>
      ) : (
        <form onSubmit={save} className="space-y-4">
          <Field label="Partner">
            <select className={inputClass} value={form.partner_id} onChange={set('partner_id')} required>
              {partners.map((p) => <option key={p.partner_id} value={p.partner_id}>{p.partner_name}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (USD)">
              <input className={inputClass} type="number" min="0.01" step="0.01" value={form.contribution_amount} onChange={set('contribution_amount')} required />
            </Field>
            <Field label="Date">
              <input className={inputClass} type="date" value={form.contribution_date} onChange={set('contribution_date')} required />
            </Field>
          </div>
          <Field label="Type">
            <select className={inputClass} value={form.contribution_type} onChange={set('contribution_type')}>
              <option value="CASH">Cash</option>
              <option value="EQUIPMENT">Equipment</option>
              <option value="MATERIALS">Materials</option>
              <option value="LABOR">Labour</option>
            </select>
          </Field>
          <Field label="Description">
            <input className={inputClass} placeholder="e.g. Broiler house roofing" value={form.description} onChange={set('description')} />
          </Field>
          <FormButtons saving={saving} onCancel={() => onClose(false)} />
        </form>
      )}
    </Modal>
  );
}
