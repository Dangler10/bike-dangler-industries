// ============================================
// TASKS - today's checklist, this week's plan, managing repeating tasks
// Tasks live in `reminders`; each tick is a row in `task_logs`.
// ============================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { loadFarm, loadPeople, personName, loadTasks, tasksForDay, sortTasks } from '../data';
import {
  Modal, ErrorBox, Field, FormButtons, inputClass, today, addDays, startOfWeek, prettyDate,
  PageHeader, PrimaryButton, SmallButton, Tabs, Badge, Empty, MiniStat,
} from '../components';

const PRIORITY_TONE = { CRITICAL: 'red', HIGH: 'orange', MEDIUM: 'yellow', LOW: 'green' };
const PRIORITY_CARD = {
  CRITICAL: 'border-l-4 border-red-500',
  HIGH: 'border-l-4 border-orange-400',
  MEDIUM: 'border-l-4 border-yellow-400',
  LOW: 'border-l-4 border-green-400',
};
const FREQ_LABEL = { DAILY: 'Every day', WEEKLY: 'Every week', MONTHLY: 'Every month', ONCE: 'Once' };
const TYPES = ['FEEDING', 'WATERING', 'HARVESTING', 'MAINTENANCE', 'HEALTH_CHECK', 'INSPECTION', 'OTHER'];
const time = (t) => (t ? String(t).slice(0, 5) : '');

export default function TasksPage({ currentUser, role }) {
  const isOwner = role === 'OWNER';
  const canTick = role === 'OWNER' || role === 'WORKER';
  const [tab, setTab] = useState('today');
  const [farmId, setFarmId] = useState(null);
  const [people, setPeople] = useState([]);
  const [data, setData] = useState(null); // { reminders, logFor }
  const [errorMsg, setErrorMsg] = useState('');
  const [busyKey, setBusyKey] = useState(null);
  const [modal, setModal] = useState(null); // { reminder } for edit, {} for new

  const t = today();
  const monday = startOfWeek(t);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    setErrorMsg('');
    try {
      const farm = await loadFarm();
      setFarmId(farm.farm_id);
      const [tasks, ppl] = await Promise.all([loadTasks(farm.farm_id, monday, addDays(monday, 6)), loadPeople()]);
      setData(tasks);
      setPeople(ppl);
    } catch (e) {
      setErrorMsg(e.message);
    }
  };

  const toggle = async (task, iso) => {
    const key = `${task.reminder_id}|${iso}`;
    setBusyKey(key);
    setErrorMsg('');
    const { error } = task.log
      ? await supabase.from('task_logs').delete().eq('task_id', task.log.task_id)
      : await supabase.from('task_logs').insert({ reminder_id: task.reminder_id, completed_date: iso, completed_by: currentUser.id });
    setBusyKey(null);
    if (error) setErrorMsg(error.message);
    else load();
  };

  const closeModal = (changed) => {
    setModal(null);
    if (changed) load();
  };

  const who = (id) => (id ? personName(people.find((p) => p.user_id === id)) : null);

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Tasks">
        {isOwner && <PrimaryButton onClick={() => setModal({})} disabled={!farmId}>+ Add Task</PrimaryButton>}
      </PageHeader>
      <ErrorBox message={errorMsg} />
      <Tabs value={tab} onChange={setTab} tabs={[['today', 'Today'], ['week', 'This week'], ['all', 'All tasks']]} />

      {!data ? <p className="text-gray-500">Loading...</p> : (
        <>
          {tab === 'today' && (
            <TodayView
              tasks={sortTasks(tasksForDay(data.reminders, data.logFor, t))}
              canTick={canTick} busyKey={busyKey} who={who} isOwner={isOwner}
              onToggle={(task) => toggle(task, t)}
            />
          )}
          {tab === 'week' && (
            <WeekView
              days={weekDays} reminders={data.reminders} logFor={data.logFor}
              canTick={canTick} busyKey={busyKey} onToggle={toggle}
            />
          )}
          {tab === 'all' && (
            <AllTasks reminders={data.reminders} who={who} isOwner={isOwner} onEdit={(r) => setModal({ reminder: r })} />
          )}
        </>
      )}

      {modal && (
        <TaskModal farmId={farmId} reminder={modal.reminder} people={people} currentUser={currentUser} onClose={closeModal} />
      )}
    </div>
  );
}

function TodayView({ tasks, canTick, busyKey, who, isOwner, onToggle }) {
  const done = tasks.filter((x) => x.log).length;
  const hours = tasks.reduce((s, x) => s + Number(x.estimated_hours || 0), 0);
  if (tasks.length === 0) {
    return <Empty>Nothing due today.{isOwner && ' Add repeating tasks (feeding, watering, checks) with "+ Add Task".'}</Empty>;
  }
  return (
    <>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <MiniStat label="Done" value={`${done} / ${tasks.length}`} tone={done === tasks.length ? 'ok' : 'warn'} />
        <MiniStat label="Overdue" value={tasks.filter((x) => x.overdue && !x.log).length}
          tone={tasks.some((x) => x.overdue && !x.log) ? 'bad' : 'ok'} />
        <MiniStat label="Planned hours" value={hours.toFixed(1)} tone="info" />
      </div>
      <div className="space-y-2">
        {tasks.map((task) => (
          <div key={task.reminder_id} className={`bg-white rounded-lg shadow p-4 flex items-start gap-3 ${PRIORITY_CARD[task.priority] || ''}`}>
            <input
              type="checkbox"
              checked={!!task.log}
              disabled={!canTick || busyKey === `${task.reminder_id}|${today()}`}
              onChange={() => onToggle(task)}
              className="w-6 h-6 mt-0.5 cursor-pointer shrink-0"
              aria-label={`Mark ${task.reminder_title} done`}
            />
            <div className="flex-1 min-w-0">
              <p className={`font-semibold ${task.log ? 'line-through text-gray-500' : 'text-gray-800'}`}>{task.reminder_title}</p>
              <p className="text-sm text-gray-600">
                {[time(task.due_time), task.location, who(task.assigned_to) && `for ${who(task.assigned_to)}`,
                  task.estimated_hours && `${Number(task.estimated_hours)} h`].filter(Boolean).join(' · ')}
              </p>
              {task.description && <p className="text-sm text-gray-500 mt-1">{task.description}</p>}
              {task.log && <p className="text-xs text-green-700 mt-1">Done{who(task.log.completed_by) ? ` by ${who(task.log.completed_by)}` : ''}</p>}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <Badge tone={PRIORITY_TONE[task.priority]}>{task.priority}</Badge>
              {task.overdue && !task.log && <Badge tone="red">Overdue since {task.due_date}</Badge>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function WeekView({ days, reminders, logFor, canTick, busyKey, onToggle }) {
  // Each task once, on the day it's due (overdue one-offs stay on their own day).
  const perDay = days.map((iso) => ({ iso, tasks: sortTasks(tasksForDay(reminders, logFor, iso, { carryOverdue: false })) }));
  const all = perDay.flatMap((d) => d.tasks);
  const hours = all.reduce((s, x) => s + Number(x.estimated_hours || 0), 0);
  const t = today();

  return (
    <>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <MiniStat label="Tasks this week" value={all.length} tone="info" />
        <MiniStat label="Done so far" value={all.filter((x) => x.log).length} />
        <MiniStat label="Planned hours" value={hours.toFixed(1)} tone="info" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {perDay.map(({ iso, tasks }) => (
          <div key={iso} className={`bg-white rounded-lg shadow ${iso === t ? 'ring-2 ring-green-500' : ''}`}>
            <div className="bg-green-50 border-b border-green-200 p-3">
              <p className="font-bold text-gray-800">{prettyDate(iso)}</p>
              <p className="text-xs text-gray-600">
                {tasks.reduce((s, x) => s + Number(x.estimated_hours || 0), 0).toFixed(1)} h · {tasks.length} task{tasks.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="p-2 space-y-2">
              {tasks.length === 0 && <p className="text-xs text-gray-400 p-1">Nothing planned</p>}
              {tasks.map((task) => (
                <label key={task.reminder_id} className={`text-sm p-2 rounded flex gap-2 items-start ${task.log ? 'bg-gray-50' : 'bg-green-50'}`}>
                  <input
                    type="checkbox"
                    checked={!!task.log}
                    disabled={!canTick || iso > t || busyKey === `${task.reminder_id}|${iso}`}
                    onChange={() => onToggle(task, iso)}
                    className="mt-0.5"
                  />
                  <span className={task.log ? 'line-through text-gray-500' : 'text-gray-800'}>
                    {time(task.due_time) && <span className="text-gray-500">{time(task.due_time)} </span>}
                    {task.reminder_title}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function AllTasks({ reminders, who, isOwner, onEdit }) {
  if (reminders.length === 0) return <Empty>No tasks yet.</Empty>;
  const groups = [['ACTIVE', 'Active'], ['PAUSED', 'Paused'], ['COMPLETED', 'Finished']];
  return groups.map(([status, label]) => {
    const rows = sortTasks(reminders.filter((r) => r.status === status));
    if (rows.length === 0) return null;
    return (
      <div key={status} className="mb-6">
        <h3 className="font-bold text-gray-700 mb-2">{label}</h3>
        <div className="bg-white rounded-lg shadow divide-y">
          {rows.map((r) => (
            <div key={r.reminder_id} className="p-4 flex flex-wrap justify-between items-center gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-gray-800">{r.reminder_title}</p>
                <p className="text-sm text-gray-600">
                  {[FREQ_LABEL[r.frequency] || 'Once', r.frequency === 'ONCE' || !r.frequency ? `on ${r.due_date}` : `from ${r.due_date}`,
                    time(r.due_time), r.reminder_type && r.reminder_type.replace('_', ' ').toLowerCase(),
                    who(r.assigned_to) && `for ${who(r.assigned_to)}`].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={PRIORITY_TONE[r.priority]}>{r.priority}</Badge>
                {isOwner && <SmallButton onClick={() => onEdit(r)}>Edit</SmallButton>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  });
}

function TaskModal({ farmId, reminder, people, currentUser, onClose }) {
  const editing = !!reminder;
  const [form, setForm] = useState(() => ({
    reminder_title: reminder?.reminder_title || '',
    reminder_type: reminder?.reminder_type || 'OTHER',
    frequency: reminder?.frequency || 'DAILY',
    due_date: reminder?.due_date || today(),
    due_time: time(reminder?.due_time),
    estimated_hours: reminder?.estimated_hours != null ? String(Number(reminder.estimated_hours)) : '',
    priority: reminder?.priority || 'MEDIUM',
    assigned_to: reminder?.assigned_to || '',
    location: reminder?.location || '',
    description: reminder?.description || '',
    status: reminder?.status || 'ACTIVE',
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const row = {
      reminder_title: form.reminder_title.trim(),
      reminder_type: form.reminder_type,
      frequency: form.frequency,
      due_date: form.due_date,
      due_time: form.due_time || null,
      estimated_hours: form.estimated_hours === '' ? null : Number(form.estimated_hours),
      priority: form.priority,
      assigned_to: form.assigned_to || null,
      location: form.location.trim() || null,
      description: form.description.trim() || null,
      status: form.status,
    };
    const { error: saveError } = editing
      ? await supabase.from('reminders').update(row).eq('reminder_id', reminder.reminder_id)
      : await supabase.from('reminders').insert({ ...row, farm_id: farmId, created_by: currentUser.id });
    setSaving(false);
    if (saveError) setError(saveError.message);
    else onClose(true);
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${reminder.reminder_title}" and its tick history? Pausing keeps the history.`)) return;
    setSaving(true);
    let { error: delError } = await supabase.from('task_logs').delete().eq('reminder_id', reminder.reminder_id);
    if (!delError) ({ error: delError } = await supabase.from('reminders').delete().eq('reminder_id', reminder.reminder_id));
    setSaving(false);
    if (delError) setError(delError.message);
    else onClose(true);
  };

  const dateLabel = form.frequency === 'ONCE' ? 'Due date'
    : form.frequency === 'WEEKLY' ? 'First day (repeats on this weekday)'
      : form.frequency === 'MONTHLY' ? 'First day (repeats on this date)' : 'Start date';

  return (
    <Modal onClose={() => onClose(false)}>
      <h3 className="text-2xl font-bold mb-4">{editing ? 'Edit Task' : 'Add Task'}</h3>
      <ErrorBox message={error} />
      <form onSubmit={save} className="space-y-4">
        <Field label="Task">
          <input className={inputClass} placeholder="e.g. Feed & water broilers" value={form.reminder_title} onChange={set('reminder_title')} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Repeats">
            <select className={inputClass} value={form.frequency} onChange={set('frequency')}>
              {Object.entries(FREQ_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select className={inputClass} value={form.priority} onChange={set('priority')}>
              {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((p) => <option key={p}>{p}</option>)}
            </select>
          </Field>
        </div>
        <Field label={dateLabel}>
          <input className={inputClass} type="date" value={form.due_date} onChange={set('due_date')} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Time">
            <input className={inputClass} type="time" value={form.due_time} onChange={set('due_time')} />
          </Field>
          <Field label="Hours needed">
            <input className={inputClass} type="number" min="0" step="0.25" value={form.estimated_hours} onChange={set('estimated_hours')} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select className={inputClass} value={form.reminder_type} onChange={set('reminder_type')}>
              {TYPES.map((x) => <option key={x} value={x}>{x.replace('_', ' ').toLowerCase()}</option>)}
            </select>
          </Field>
          <Field label="Assigned to">
            <select className={inputClass} value={form.assigned_to} onChange={set('assigned_to')}>
              <option value="">Anyone</option>
              {people.map((p) => <option key={p.user_id} value={p.user_id}>{personName(p)}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Where">
          <input className={inputClass} placeholder="Broiler House 1, Plot A..." value={form.location} onChange={set('location')} />
        </Field>
        <Field label="Instructions">
          <textarea className={`${inputClass} h-20`} value={form.description} onChange={set('description')} />
        </Field>
        {editing && (
          <Field label="Status">
            <select className={inputClass} value={form.status} onChange={set('status')}>
              <option value="ACTIVE">Active</option>
              <option value="PAUSED">Paused</option>
              <option value="COMPLETED">Finished</option>
            </select>
          </Field>
        )}
        <FormButtons saving={saving} onCancel={() => onClose(false)} />
        {editing && (
          <button type="button" onClick={remove} disabled={saving} className="w-full text-sm text-red-600 hover:text-red-700 py-1">
            Delete task
          </button>
        )}
      </form>
    </Modal>
  );
}
