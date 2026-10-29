// ============================================
// PARTNER DASHBOARD - a personal dashboard for each partner (their
// investment, what they paid, critical farm info), plus the
// farm's money summary, transactions and capital log.
// Needs supabase/03 (partner_position) and 07 (transactions.paid_by).
// ============================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { loadFarm, loadTasks, tasksForDay, maintenanceStatus } from '../data';
import {
  Modal, ErrorBox, Field, FormButtons, inputClass, today, addDays, startOfWeek, money, MONTHS, toDate,
  PageHeader, PrimaryButton, SmallButton, MiniStat, Badge, Tabs, Empty,
} from '../components';

const monthKey = (iso) => iso.slice(0, 7);
const monthLabel = (key) => `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
const sum = (rows, key) => rows.reduce((s, r) => s + Number(r[key] || 0), 0);
const sumType = (rows, type) => rows.filter((t) => t.transaction_type === type).reduce((s, t) => s + Number(t.amount), 0);

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
  const [snap, setSnap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [modal, setModal] = useState(null); // { type: 'txn' | 'contribution', paidBy? }
  const [tab, setTab] = useState('me');
  const [viewing, setViewing] = useState(null); // partner_id whose dashboard is open
  const [txnFilter, setTxnFilter] = useState('ALL');
  const [payerFilter, setPayerFilter] = useState('ALL');

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const farm = await loadFarm();
      const id = farm.farm_id;
      setFarmId(id);
      const monday = startOfWeek(today());
      const [pos, con, txn, fl, pl, active, stock, eq, tasks] = await Promise.all([
        supabase.from('partner_position').select('*'),
        supabase.from('partner_contributions').select('*').eq('farm_id', id).order('contribution_date', { ascending: false }),
        supabase.from('transactions').select('*').eq('farm_id', id)
          .order('date', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('flocks').select('flock_id, batch_number, status').eq('farm_id', id).order('start_date', { ascending: false }),
        supabase.from('planting_summary').select('*').eq('farm_id', id).order('planting_date', { ascending: false }),
        supabase.from('flock_summary').select('*').eq('farm_id', id).eq('status', 'ACTIVE'),
        supabase.from('inventory_levels').select('*').eq('farm_id', id),
        supabase.from('equipment').select('*').eq('farm_id', id),
        loadTasks(id, monday, addDays(monday, 6)).catch(() => null),
      ]);
      const firstError = [pos, con, txn].find((r) => r.error)?.error;
      if (firstError) setErrorMsg(firstError.message);
      setPositions(pos.data || []);
      setContributions(con.data || []);
      setTransactions(txn.data || []);
      setFlocks(fl.data || []);
      setPlantings(pl.data || []);

      // Critical farm info shown on every personal dashboard
      let week = { total: 0, done: 0, overdue: 0 };
      if (tasks) {
        for (let i = 0; i < 7; i++) {
          const iso = addDays(monday, i);
          const list = tasksForDay(tasks.reminders, tasks.logFor, iso, { carryOverdue: false });
          week.total += list.length;
          week.done += list.filter((x) => x.log).length;
          week.overdue += list.filter((x) => !x.log && iso < today()).length;
        }
      }
      setSnap({
        batches: active.data || [],
        crops: (pl.data || []).filter((p) => ['NURSERY', 'GROWING', 'READY_FOR_HARVEST'].includes(p.current_status)),
        lowStock: (stock.data || []).filter((i) => i.is_low || Number(i.quantity_in_stock) <= 0),
        equipment: (eq.data || []).map((e) => ({ ...e, ms: maintenanceStatus(e) }))
          .filter((e) => ['Overdue', 'Broken', 'Due this week'].includes(e.ms.label)),
        week,
      });
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

  // ---- who sees whose dashboard ----
  // An investor opens on their own; owners can switch to any partner, a
  // partner (non-owner) only ever sees their own.
  const visible = role === 'PARTNER' ? positions.filter((p) => p.partner_id === currentUser.id) : positions;
  const current = visible.find((p) => p.partner_id === viewing)
    || visible.find((p) => p.partner_id === currentUser.id)
    || visible[0];
  const nameOf = (id) => positions.find((p) => p.partner_id === id)?.partner_name || null;

  // ---- farm-wide totals ----
  const income = sumType(transactions, 'INCOME');
  const expenses = sumType(transactions, 'EXPENSE');
  const thisMonth = transactions.filter((t) => monthKey(t.date) === monthKey(today()));
  const monthIncome = sumType(thisMonth, 'INCOME');
  const monthExpenses = sumType(thisMonth, 'EXPENSE');
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = toDate(today());
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    months.push(d.toLocaleDateString('en-CA').slice(0, 7));
  }
  const monthly = months.map((m) => {
    const rows = transactions.filter((t) => monthKey(t.date) === m);
    return { m, income: sumType(rows, 'INCOME'), expenses: sumType(rows, 'EXPENSE') };
  });

  const shownTxns = transactions
    .filter((t) => txnFilter === 'ALL' || t.transaction_type === txnFilter)
    .filter((t) => payerFilter === 'ALL' || (payerFilter === 'FARM' ? !t.paid_by : t.paid_by === payerFilter));
  const label = (t) => {
    const flock = t.flock_id && flocks.find((f) => f.flock_id === t.flock_id);
    const pl = t.planting_id && plantings.find((p) => p.planting_id === t.planting_id);
    return flock ? `Batch ${flock.batch_number}` : pl ? `${pl.crop_name} (${pl.field_name})` : null;
  };

  const TxnRow = ({ t }) => (
    <div className="py-3 flex justify-between items-start gap-3">
      <div className="min-w-0">
        <p className="font-semibold text-gray-800">{t.description || t.category || t.transaction_type}</p>
        <p className="text-sm text-gray-600">
          {t.date}{t.category ? ` · ${t.category}` : ''}{t.payment_method ? ` · ${t.payment_method}` : ''}
        </p>
        <div className="flex flex-wrap gap-1 mt-1">
          {label(t) && <Badge tone="blue">{label(t)}</Badge>}
          {t.paid_by && nameOf(t.paid_by) && <Badge tone="yellow">Paid by {nameOf(t.paid_by)}</Badge>}
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className={`font-bold ${t.transaction_type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
          {t.transaction_type === 'INCOME' ? '+' : '-'}{money(t.amount)}
        </p>
        {isOwner && <button onClick={() => deleteTxn(t)} className="text-xs text-gray-500 hover:text-red-600 mt-1">Delete</button>}
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Partner Dashboard">
        {isOwner && (
          <>
            <PrimaryButton onClick={() => setModal({ type: 'contribution' })} disabled={!farmId}>+ Capital</PrimaryButton>
            <PrimaryButton onClick={() => setModal({ type: 'txn' })} disabled={!farmId}>+ Expense / Income</PrimaryButton>
          </>
        )}
      </PageHeader>

      <ErrorBox message={errorMsg} />

      {loading ? <p className="text-gray-500">Loading...</p> : (
        <>
          {visible.length === 0 ? (
            <Empty>
              No investors yet.{isOwner && ' Tick "Investor" for someone on the Team page, then record their capital here.'}
            </Empty>
          ) : visible.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-sm text-gray-600 mr-1">Partner:</span>
              {visible.map((p) => (
                <SmallButton key={p.partner_id} tone={current?.partner_id === p.partner_id ? 'green' : 'gray'}
                  onClick={() => { setViewing(p.partner_id); setTab('me'); }}>
                  {p.partner_name}{p.partner_id === currentUser.id ? ' (you)' : ''}
                </SmallButton>
              ))}
            </div>
          )}

          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              ['me', current ? (current.partner_id === currentUser.id ? 'My dashboard' : `${current.partner_name}'s dashboard`) : 'Dashboard'],
              ['money', 'Farm money'],
              ['transactions', `Transactions (${transactions.length})`],
              ['capital', `Capital (${contributions.length})`],
            ]}
          />

          {tab === 'me' && (current ? (
            <PersonalDashboard
              p={current} isMe={current.partner_id === currentUser.id} isOwner={isOwner}
              contributions={contributions} transactions={transactions}
              snap={snap} income={income} expenses={expenses} monthIncome={monthIncome} monthExpenses={monthExpenses}
              TxnRow={TxnRow} onDeleteContribution={deleteContribution}
              onAddExpense={() => setModal({ type: 'txn', paidBy: current.partner_id })}
            />
          ) : <Empty>Nothing to show yet.</Empty>)}

          {tab === 'money' && (
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
                        <td className={`text-right font-semibold ${r.income - r.expenses >= 0 ? 'text-gray-800' : 'text-red-600'}`}>{money(r.income - r.expenses)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'transactions' && (
            <div className="bg-white rounded-lg shadow p-4 md:p-6">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {['ALL', 'INCOME', 'EXPENSE'].map((f) => (
                  <SmallButton key={f} tone={txnFilter === f ? 'green' : 'gray'} onClick={() => setTxnFilter(f)}>
                    {f === 'ALL' ? 'All' : f === 'INCOME' ? 'Income' : 'Expenses'}
                  </SmallButton>
                ))}
                <select value={payerFilter} onChange={(e) => setPayerFilter(e.target.value)}
                  className="border border-gray-300 rounded px-2 py-2 text-sm ml-auto" aria-label="Paid by">
                  <option value="ALL">Paid by: anyone</option>
                  {positions.map((p) => <option key={p.partner_id} value={p.partner_id}>Paid by {p.partner_name}</option>)}
                  <option value="FARM">Paid by the farm</option>
                </select>
              </div>
              {shownTxns.length === 0 ? <p className="text-gray-500">No transactions yet.</p> : (
                <div className="divide-y">{shownTxns.map((t) => <TxnRow key={t.transaction_id} t={t} />)}</div>
              )}
            </div>
          )}

          {tab === 'capital' && (
            <div className="bg-white rounded-lg shadow p-4 md:p-6">
              {contributions.length === 0 ? <p className="text-gray-500">No capital recorded yet.</p> : (
                <div className="divide-y">
                  {contributions.map((c) => (
                    <ContributionRow key={c.contribution_id} c={c} who={nameOf(c.partner_id)} isOwner={isOwner} onDelete={deleteContribution} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {modal?.type === 'txn' && (
        <TransactionModal farmId={farmId} flocks={flocks} plantings={plantings} partners={positions}
          paidBy={modal.paidBy || ''} currentUser={currentUser} onClose={closeModal} />
      )}
      {modal?.type === 'contribution' && (
        <ContributionModal farmId={farmId} partners={positions} onClose={closeModal} />
      )}
    </div>
  );
}

function ContributionRow({ c, who, isOwner, onDelete }) {
  return (
    <div className="py-3 flex justify-between items-start gap-3">
      <div>
        <p className="font-semibold text-gray-800">{c.description || `${c.contribution_type || 'Capital'} contribution`}</p>
        <p className="text-sm text-gray-600">
          {c.contribution_date}{who ? ` · ${who}` : ''}{c.contribution_type ? ` · ${c.contribution_type}` : ''}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-bold text-blue-700">{money(c.contribution_amount)}</p>
        {isOwner && <button onClick={() => onDelete(c)} className="text-xs text-gray-500 hover:text-red-600 mt-1">Delete</button>}
      </div>
    </div>
  );
}

// ============================================
// A PARTNER'S PERSONAL DASHBOARD
// ============================================

function PersonalDashboard({
  p, isMe, isOwner, contributions, transactions, snap, income, expenses, monthIncome, monthExpenses,
  TxnRow, onDeleteContribution, onAddExpense,
}) {
  const myContribs = contributions.filter((c) => c.partner_id === p.partner_id);
  const myPaid = transactions.filter((t) => t.transaction_type === 'EXPENSE' && t.paid_by === p.partner_id);
  const paidTotal = sum(myPaid, 'amount');
  const be = breakeven(p);
  const stake = Number(p.total_contributed) + Number(p.profit_share);
  const categoryTotals = {};
  myPaid.forEach((t) => {
    const cat = t.category || 'Other';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(t.amount);
  });
  const byCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      {/* ---- investment ---- */}
      <section className="bg-white rounded-lg shadow p-4 md:p-6">
        <div className="flex flex-wrap justify-between items-baseline gap-2 mb-4">
          <h3 className="text-xl font-bold">{isMe ? 'My investment' : `${p.partner_name}'s investment`}</h3>
          <span className="text-sm text-gray-600">{Number(p.profit_share_pct)}% of farm profit</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <MiniStat label="Capital put in" value={money(p.total_contributed)}
            sub={`${p.contributions} contribution${Number(p.contributions) === 1 ? '' : 's'}${p.first_contribution_date ? ` since ${p.first_contribution_date}` : ''}`} tone="info" />
          <MiniStat label="Expenses paid personally" value={money(paidTotal)}
            sub={`${myPaid.length} item${myPaid.length === 1 ? '' : 's'}`} tone="warn" />
          <MiniStat label="Share of profit" value={money(p.profit_share)}
            sub={`${Number(p.profit_share_pct)}% of ${money(p.net_profit)}`} tone={Number(p.profit_share) >= 0 ? 'ok' : 'bad'} />
          <MiniStat label="Return (ROI)" value={p.roi_pct === null ? '—' : `${Number(p.roi_pct)}%`}
            sub="share ÷ capital" tone={Number(p.roi_pct) >= 0 ? 'ok' : 'bad'} />
          <MiniStat label="Capital paid back" value={be.text} sub={be.sub} tone={be.tone || 'warn'} />
          <MiniStat label="Stake value" value={money(stake)}
            sub="capital + share of profit" tone={stake >= Number(p.total_contributed) ? 'ok' : 'warn'} />
        </div>
      </section>

      {/* ---- their money in and out ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-lg shadow p-4 md:p-6">
          <h3 className="text-lg font-bold mb-2">Capital {isMe ? 'I put' : `${p.partner_name} put`} in</h3>
          {myContribs.length === 0 ? <p className="text-gray-500 text-sm">No capital recorded yet.</p> : (
            <div className="divide-y">
              {myContribs.map((c) => (
                <ContributionRow key={c.contribution_id} c={c} who={null} isOwner={isOwner} onDelete={onDeleteContribution} />
              ))}
            </div>
          )}
        </section>

        <section className="bg-white rounded-lg shadow p-4 md:p-6">
          <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
            <h3 className="text-lg font-bold">Expenses {isMe ? 'I paid' : `${p.partner_name} paid`}</h3>
            {isOwner && <SmallButton tone="green" onClick={onAddExpense}>+ Expense</SmallButton>}
          </div>
          {myPaid.length === 0 ? <p className="text-gray-500 text-sm">No expenses recorded as paid by {isMe ? 'you' : p.partner_name}.</p> : (
            <>
              <div className="flex flex-wrap gap-1 mb-2">
                {byCategory.map(([cat, v]) => <Badge key={cat} tone="gray">{cat} {money(v)}</Badge>)}
              </div>
              <div className="divide-y max-h-96 overflow-y-auto">{myPaid.map((t) => <TxnRow key={t.transaction_id} t={t} />)}</div>
            </>
          )}
        </section>
      </div>

      {/* ---- critical farm info ---- */}
      <FarmSnapshot snap={snap} income={income} expenses={expenses} monthIncome={monthIncome} monthExpenses={monthExpenses} />
    </div>
  );
}

function FarmSnapshot({ snap, income, expenses, monthIncome, monthExpenses }) {
  if (!snap) return null;
  const alerts = [
    ...snap.batches.filter((f) => f.age_days >= 0 && f.last_log_date !== today()).map((f) => ({ tone: 'orange', text: `Batch ${f.batch_number} not logged today` })),
    ...snap.batches.filter((f) => Number(f.mortality_pct) >= 5).map((f) => ({ tone: 'red', text: `Batch ${f.batch_number}: ${Number(f.mortality_pct)}% deaths so far` })),
    ...snap.lowStock.map((i) => ({ tone: Number(i.quantity_in_stock) <= 0 ? 'red' : 'orange', text: `${i.item_name}: ${Number(i.quantity_in_stock) <= 0 ? 'out of stock' : 'running low'}` })),
    ...snap.equipment.map((e) => ({ tone: e.ms.tone, text: `${e.equipment_name}: ${e.ms.label.toLowerCase()}` })),
    ...(snap.week.overdue > 0 ? [{ tone: 'red', text: `${snap.week.overdue} task${snap.week.overdue === 1 ? '' : 's'} overdue this week` }] : []),
  ];
  const net = income - expenses;
  return (
    <section className="bg-white rounded-lg shadow p-4 md:p-6">
      <h3 className="text-xl font-bold mb-4">The farm right now</h3>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MiniStat label="Net profit (all time)" value={money(net)} tone={net >= 0 ? 'ok' : 'bad'} sub={`Income ${money(income)} · costs ${money(expenses)}`} />
        <MiniStat label="This month" value={money(monthIncome - monthExpenses)} tone={monthIncome - monthExpenses >= 0 ? 'ok' : 'bad'}
          sub={`In ${money(monthIncome)} · out ${money(monthExpenses)}`} />
        <MiniStat label="Birds on farm" value={snap.batches.reduce((s, f) => s + f.birds_alive, 0).toLocaleString()} tone="info"
          sub={`${snap.batches.length} active batch${snap.batches.length === 1 ? '' : 'es'}`} />
        <MiniStat label="Tasks this week" value={snap.week.total ? `${snap.week.done} / ${snap.week.total}` : '—'}
          tone={snap.week.overdue ? 'bad' : snap.week.total && snap.week.done === snap.week.total ? 'ok' : 'info'} sub={snap.week.total ? 'done' : 'none planned'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h4 className="font-bold mb-2">Broiler batches</h4>
          {snap.batches.length === 0 ? <p className="text-sm text-gray-500">No active batches.</p> : (
            <div className="space-y-2">
              {snap.batches.map((f) => (
                <div key={f.flock_id} className="border border-gray-200 rounded p-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold">Batch {f.batch_number}</span>
                    <span className="text-gray-600">{f.age_days < 0 ? `arrives in ${-f.age_days} days` : `day ${f.age_days}`}</span>
                  </div>
                  <p className="text-gray-600">
                    {f.birds_alive}/{f.bird_count} alive · {Number(f.mortality_pct || 0)}% deaths
                    {f.expected_harvest_date ? ` · harvest ${f.expected_harvest_date}` : ''} ·{' '}
                    <span className={Number(f.profit) >= 0 ? 'text-green-700' : 'text-red-600'}>profit so far {money(f.profit)}</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h4 className="font-bold mb-2">Crops growing</h4>
          {snap.crops.length === 0 ? <p className="text-sm text-gray-500">Nothing planted yet.</p> : (
            <div className="space-y-2">
              {snap.crops.map((c) => (
                <div key={c.planting_id} className="border border-gray-200 rounded p-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold">{c.crop_name} · {c.field_name}</span>
                    <span className="text-gray-600">{c.days_to_harvest == null ? '' : c.days_to_harvest > 0 ? `harvest in ${c.days_to_harvest} days` : c.days_to_harvest === 0 ? 'harvest today' : `${-c.days_to_harvest} days past due`}</span>
                  </div>
                  <p className="text-gray-600">Planted {c.planting_date} · {Number(c.harvested_kg)} kg harvested · <span className={Number(c.profit) >= 0 ? 'text-green-700' : 'text-red-600'}>profit {money(c.profit)}</span></p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <h4 className="font-bold mt-6 mb-2">Needs attention</h4>
      {alerts.length === 0 ? <p className="text-sm text-gray-500">Nothing urgent. 👍</p> : (
        <div className="flex flex-wrap gap-2">
          {alerts.map((a, i) => <Badge key={i} tone={a.tone}>{a.text}</Badge>)}
        </div>
      )}
    </section>
  );
}

// ============================================
// FORMS
// ============================================

function TransactionModal({ farmId, flocks, plantings, partners, paidBy, currentUser, onClose }) {
  const [form, setForm] = useState({
    transaction_type: 'EXPENSE', category: '', amount: '', description: '',
    date: today(), payment_method: '', link: '', paid_by: paidBy || '',
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
      paid_by: form.transaction_type === 'EXPENSE' && form.paid_by ? form.paid_by : null,
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
            {['Feed', 'Chicks', 'Vaccines', 'Seeds', 'Fertilizer', 'Chemicals', 'Labour', 'Fuel', 'Materials', 'Tools', 'Machinery hire', 'Transport', 'Electricity', 'Water', 'Maintenance', 'Broiler sales', 'Crop sales'].map((c) => <option key={c} value={c} />)}
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
        {form.transaction_type === 'EXPENSE' && (
          <Field label="Paid by" hint="A partner who paid out of their own pocket; counts toward their dashboard">
            <select className={inputClass} value={form.paid_by} onChange={set('paid_by')}>
              <option value="">The farm (not a partner)</option>
              {partners.map((p) => <option key={p.partner_id} value={p.partner_id}>{p.partner_name}</option>)}
            </select>
          </Field>
        )}
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
