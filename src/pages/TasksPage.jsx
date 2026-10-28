// ============================================
// TASKS - today's checklist, this week's plan, managing repeating tasks
// Tasks live in `reminders`; each tick is a row in `task_logs`.
// ============================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { loadFarm, loadPeople, personName, loadTasks, tasksForDay, sortTasks, tasksByDay, toggleTaskDone } from '../data';
import { MonthCalendar, Agenda, TaskCard, PRIORITY_TONE, timeStr as time } from '../taskViews';
import {
  Modal, ErrorBox, Field, FormButtons, inputClass, today, addDays, startOfWeek, prettyDate,
  PageHeader, PrimaryButton, SmallButton, Tabs, Badge, Empty, MiniStat,
} from '../components';

const FREQ_LABEL = { DAILY: 'Every day', WEEKLY: 'Every week', MONTHLY: 'Every month', ONCE: 'Once' };
const TYPES = ['FEEDING', 'WATERING', 'HARVESTING', 'MAINTENANCE', 'HEALTH_CHECK', 'INSPECTION', 'OTHER'];

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
  const [month, setMonth] = useState(`${t.slice(0, 7)}-01`);
  const [selected, setSelected] = useState(t);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    setErrorMsg('');
    try {
      const farm = await loadFarm();
      setFarmId(farm.farm_id);
      const [tasks, ppl] = await Promise.all([loadTasks(farm.farm_id, addDays(monday, -70), addDays(monday, 260)), loadPeople()]);
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
    const message = await toggleTaskDone(task, iso, currentUser.id);
    setBusyKey(null);
    if (message) setErrorMsg(message);
    else load();
  };

  // Calendar: month navigation (0 = back to today)
  const shiftMonth = (delta) => {
    if (delta === 0) {
      setMonth(`${t.slice(0, 7)}-01`);
      setSelected(t);
      return;
    }
    const d = new Date(`${month}T00:00:00`);
    d.setMonth(d.getMonth() + delta);
    setMonth(`${d.toLocaleDateString('en-CA').slice(0, 7)}-01`);
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
      <Tabs value={tab} onChange={setTab} tabs={[['today', 'Today'], ['week', 'This week'], ['calendar', 'Calendar'], ['all', 'All tasks']]} />

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
          {tab === 'calendar' && (
            <>
              <MonthCalendar month={month} reminders={data.reminders} logFor={data.logFor}
                selected={selected} onSelect={setSelected} onMonth={shiftMonth} />
              <DayDetail iso={selected} reminders={data.reminders} logFor={data.logFor}
                canTick={canTick} busyKey={busyKey} who={who} onToggle={toggle}
                onEdit={isOwner ? (task) => setModal({ reminder: task }) : null} />
            </>
          )}
          {tab === 'all' && (
            <AllTasksTab data={data} canTick={canTick} busyKey={busyKey} who={who} isOwner={isOwner}
              onToggle={toggle} onEdit={(r) => setModal({ reminder: r })} />
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
          <TaskCard key={task.reminder_id} task={task} iso={today()} canTick={canTick} who={who}
            busy={busyKey === `${task.reminder_id}|${today()}`} onToggle={onToggle} />
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

// The tasks of one day picked on the calendar.
function DayDetail({ iso, reminders, logFor, canTick, busyKey, who, onToggle, onEdit }) {
  const tasks = tasksByDay(reminders, logFor, iso, iso).get(iso) || [];
  const done = tasks.filter((x) => x.log).length;
  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h3 className="text-xl font-bold text-gray-800">{prettyDate(iso)}{iso === today() && <span className="text-green-700"> · today</span>}</h3>
        <span className="text-sm text-gray-600">{tasks.length ? `${done} of ${tasks.length} done` : 'nothing planned'}</span>
      </div>
      {tasks.length === 0 ? <Empty>Nothing planned for this day.</Empty> : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskCard key={task.reminder_id} task={task} iso={iso} canTick={canTick} who={who}
              busy={busyKey === `${task.reminder_id}|${iso}`} onToggle={onToggle} onEdit={onEdit} />
          ))}
        </div>
      )}
    </section>
  );
}

// "All tasks": by date (weeks > days) or the flat list used to edit / pause tasks.
function AllTasksTab({ data, canTick, busyKey, who, isOwner, onToggle, onEdit }) {
  const [view, setView] = useState('date');
  return (
    <>
      <div className="flex gap-2 mb-4">
        <SmallButton tone={view === 'date' ? 'green' : 'gray'} onClick={() => setView('date')}>By date</SmallButton>
        <SmallButton tone={view === 'list' ? 'green' : 'gray'} onClick={() => setView('list')}>Manage list</SmallButton>
      </div>
      {view === 'date' ? (
        <Agenda reminders={data.reminders} logFor={data.logFor} canTick={canTick} busyKey={busyKey} who={who}
          onToggle={onToggle} onEdit={isOwner ? (task) => onEdit(task) : null} />
      ) : (
        <AllTasks reminders={data.reminders} who={who} isOwner={isOwner} onEdit={onEdit} />
      )}
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
