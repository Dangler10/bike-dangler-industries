// ============================================
// TASK VIEWS shared by the Tasks page and the Dashboard:
// month calendar (weeks x days), date-ordered agenda, this-week board.
// ============================================

import React, { useState, useMemo } from 'react';
import { today, addDays, startOfWeek, toDate, prettyDate, Badge, SmallButton, Empty } from './components';
import { tasksByDay, weekDays, taskStatus } from './data';

export const PRIORITY_TONE = { CRITICAL: 'red', HIGH: 'orange', MEDIUM: 'yellow', LOW: 'green' };
export const PRIORITY_CARD = {
  CRITICAL: 'border-l-4 border-red-500',
  HIGH: 'border-l-4 border-orange-400',
  MEDIUM: 'border-l-4 border-yellow-400',
  LOW: 'border-l-4 border-green-400',
};
const DOT = { CRITICAL: 'bg-red-500', HIGH: 'bg-orange-400', MEDIUM: 'bg-yellow-400', LOW: 'bg-green-400' };
export const timeStr = (t) => (t ? String(t).slice(0, 5) : '');

const shortDay = (iso) => toDate(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
export const weekRange = (mondayIso) => `${shortDay(mondayIso)} – ${shortDay(addDays(mondayIso, 6))}`;

// ---------- status mark: done / overdue / to do ----------

export function StatusMark({ status, onClick, disabled, label }) {
  const look = {
    done: 'bg-green-600 border-green-600 text-white',
    overdue: 'bg-white border-red-500 text-red-600',
    todo: 'bg-white border-gray-400 text-transparent',
  }[status];
  const mark = status === 'done' ? '✓' : status === 'overdue' ? '!' : '·';
  const cls = `w-6 h-6 shrink-0 rounded-full border-2 flex items-center justify-center text-xs font-bold ${look}`;
  if (!onClick) return <span className={cls} aria-label={status}>{mark}</span>;
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label}
      className={`${cls} ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:ring-2 hover:ring-green-300 cursor-pointer'}`}>
      {mark}
    </button>
  );
}

// ---------- full task card (used for a day's list) ----------

export function TaskCard({ task, iso, canTick, busy, who, onToggle, onEdit }) {
  const status = taskStatus(task, iso);
  return (
    <div className={`bg-white rounded-lg shadow p-4 flex items-start gap-3 ${PRIORITY_CARD[task.priority] || ''}`}>
      <StatusMark
        status={status}
        onClick={() => onToggle(task, iso)}
        disabled={!canTick || iso > today() || busy}
        label={`${task.log ? 'Un-tick' : 'Mark done'}: ${task.reminder_title}`}
      />
      <div className="flex-1 min-w-0">
        <p className={`font-semibold ${task.log ? 'line-through text-gray-500' : 'text-gray-800'}`}>{task.reminder_title}</p>
        <p className="text-sm text-gray-600">
          {[timeStr(task.due_time), task.location, who && who(task.assigned_to) && `for ${who(task.assigned_to)}`,
            task.estimated_hours && `${Number(task.estimated_hours)} h`].filter(Boolean).join(' · ')}
        </p>
        {task.description && <p className="text-sm text-gray-500 mt-1">{task.description}</p>}
        {task.log && <p className="text-xs text-green-700 mt-1">Done{who && who(task.log.completed_by) ? ` by ${who(task.log.completed_by)}` : ''}</p>}
        {status === 'overdue' && <p className="text-xs text-red-600 mt-1 font-semibold">Not done, overdue</p>}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <Badge tone={PRIORITY_TONE[task.priority]}>{task.priority}</Badge>
        {onEdit && <SmallButton onClick={() => onEdit(task)}>Edit</SmallButton>}
      </div>
    </div>
  );
}

// ---------- month calendar: weeks as rows, days as cells ----------

const MONTH_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function MonthCalendar({ month, reminders, logFor, selected, onSelect, onMonth }) {
  const t = today();
  const lastDay = (() => {
    const d = toDate(month);
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    return d.toLocaleDateString('en-CA');
  })();
  const gridStart = startOfWeek(month);
  const gridEnd = addDays(startOfWeek(lastDay), 6);
  const byDay = useMemo(() => tasksByDay(reminders, logFor, gridStart, gridEnd), [reminders, logFor, gridStart, gridEnd]);
  const weeks = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 7)) weeks.push(Array.from({ length: 7 }, (_, i) => addDays(d, i)));
  const title = toDate(month).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <div className="bg-white rounded-lg shadow p-3 md:p-4 mb-6">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-xl font-bold text-gray-800">{title}</h3>
        <div className="flex gap-2">
          <SmallButton onClick={() => onMonth(-1)} aria-label="Previous month">‹</SmallButton>
          <SmallButton onClick={() => onMonth(0)}>Today</SmallButton>
          <SmallButton onClick={() => onMonth(1)} aria-label="Next month">›</SmallButton>
        </div>
      </div>

      <div className="grid grid-cols-[2.6rem_repeat(7,minmax(0,1fr))] md:grid-cols-[4.5rem_repeat(7,minmax(0,1fr))] text-xs md:text-sm">
        <div className="py-1 text-gray-500 font-semibold">Week</div>
        {MONTH_DAYS.map((d) => <div key={d} className="py-1 text-center text-gray-500 font-semibold">{d}</div>)}

        {weeks.map((w) => {
          const all = w.flatMap((iso) => byDay.get(iso) || []);
          const done = all.filter((x) => x.log).length;
          const isThisWeek = w.includes(t);
          return (
            <React.Fragment key={w[0]}>
              <div className={`border-t py-1 pr-1 text-[10px] md:text-xs leading-tight ${isThisWeek ? 'text-green-700 font-bold' : 'text-gray-500'}`}>
                <span className="block">{shortDay(w[0])}</span>
                {all.length > 0 && <span className="block">{done}/{all.length}</span>}
              </div>
              {w.map((iso) => {
                const tasks = byDay.get(iso) || [];
                const inMonth = iso.slice(0, 7) === month.slice(0, 7);
                const doneN = tasks.filter((x) => x.log).length;
                const anyOverdue = tasks.some((x) => taskStatus(x, iso) === 'overdue');
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => onSelect(iso)}
                    className={`text-left border-t border-l p-1 md:p-1.5 min-h-[56px] md:min-h-[104px] flex flex-col gap-0.5 overflow-hidden
                      ${inMonth ? 'bg-white' : 'bg-gray-50'} ${iso === selected ? 'ring-2 ring-green-600 relative z-10' : 'hover:bg-green-50'}`}
                    aria-label={`${prettyDate(iso)}: ${tasks.length} task${tasks.length === 1 ? '' : 's'}`}
                  >
                    <span className={`self-start text-xs md:text-sm font-semibold leading-none px-1.5 py-1 rounded-full
                      ${iso === t ? 'bg-green-600 text-white' : inMonth ? 'text-gray-800' : 'text-gray-400'}`}>
                      {toDate(iso).getDate()}
                    </span>
                    {/* wide screens: the first few task names */}
                    {tasks.slice(0, 3).map((x) => (
                      <span key={x.reminder_id} className="hidden md:flex items-center gap-1 text-xs truncate">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${x.log ? 'bg-gray-300' : DOT[x.priority] || 'bg-gray-400'}`} />
                        <span className={`truncate ${x.log ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                          {timeStr(x.due_time) && `${timeStr(x.due_time)} `}{x.reminder_title.replace(/^Covo:?\s*/, '')}
                        </span>
                      </span>
                    ))}
                    {tasks.length > 3 && <span className="hidden md:block text-xs text-gray-500">+{tasks.length - 3} more</span>}
                    {/* phones: just a count */}
                    {tasks.length > 0 && (
                      <span className={`md:hidden self-start text-[10px] font-bold px-1 rounded
                        ${doneN === tasks.length ? 'bg-green-100 text-green-700' : anyOverdue ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                        {doneN}/{tasks.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>
      <p className="text-xs text-gray-500 mt-3">
        Tap a day to see and tick its tasks. Weeks run Monday–Sunday; the small numbers are done / planned.
      </p>
    </div>
  );
}

// ---------- agenda: every task in date order, grouped by week then day ----------

export function Agenda({ reminders, logFor, canTick, busyKey, who, onToggle, onEdit }) {
  const t = today();
  const [showPast, setShowPast] = useState(false);
  const [extraWeeks, setExtraWeeks] = useState(0);

  const active = reminders.filter((r) => r.status === 'ACTIVE' && r.due_date);
  if (active.length === 0) return <Empty>No tasks yet.</Empty>;

  const thisMonday = startOfWeek(t);
  const earliest = startOfWeek(active.reduce((m, r) => (r.due_date < m ? r.due_date : m), active[0].due_date));
  const start = showPast && earliest < thisMonday ? earliest : thisMonday;
  const lastOnce = active.filter((r) => !r.frequency || r.frequency === 'ONCE').reduce((m, r) => (r.due_date > m ? r.due_date : m), thisMonday);
  const minEnd = addDays(thisMonday, 8 * 7 + extraWeeks * 7 - 1);
  const end = addDays(startOfWeek(lastOnce > minEnd ? lastOnce : minEnd), 6);
  const hasPast = earliest < thisMonday;

  const byDay = tasksByDay(reminders, logFor, start, end);
  const weeks = [];
  for (let d = start; d <= end; d = addDays(d, 7)) {
    const days = weekDays(d).map((iso) => ({ iso, tasks: byDay.get(iso) || [] })).filter((x) => x.tasks.length > 0);
    if (days.length > 0 || d === thisMonday) weeks.push({ monday: d, days });
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <p className="text-sm text-gray-600">Every task in date order, by week and day. Repeating tasks appear on each of their days.</p>
        {hasPast && (
          <SmallButton onClick={() => setShowPast(!showPast)}>{showPast ? 'Hide earlier weeks' : 'Show earlier weeks'}</SmallButton>
        )}
      </div>

      <div className="space-y-8">
        {weeks.map(({ monday, days }) => {
          const all = days.flatMap((d) => d.tasks);
          const done = all.filter((x) => x.log).length;
          const current = monday === thisMonday;
          return (
            <section key={monday}>
              <div className={`flex flex-wrap items-baseline justify-between gap-2 border-b-2 pb-1 mb-3 ${current ? 'border-green-600' : 'border-gray-300'}`}>
                <h3 className="text-lg font-bold text-gray-800">
                  Week of {weekRange(monday)}
                  {current && <span className="ml-2 align-middle"><Badge tone="green">This week</Badge></span>}
                </h3>
                <span className="text-sm text-gray-600">{done} of {all.length} done</span>
              </div>
              {days.length === 0 ? <p className="text-sm text-gray-500">Nothing planned this week.</p> : (
                <div className="space-y-4">
                  {days.map(({ iso, tasks }) => (
                    <div key={iso}>
                      <p className={`text-sm font-bold mb-2 ${iso === t ? 'text-green-700' : 'text-gray-700'}`}>
                        {prettyDate(iso)}{iso === t && ' · today'}
                      </p>
                      <div className="space-y-2">
                        {tasks.map((task) => (
                          <TaskCard key={task.reminder_id} task={task} iso={iso} canTick={canTick} who={who}
                            busy={busyKey === `${task.reminder_id}|${iso}`} onToggle={onToggle} onEdit={onEdit} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
      <button onClick={() => setExtraWeeks(extraWeeks + 8)} className="mt-6 text-green-700 font-semibold">Show 8 more weeks</button>
    </>
  );
}

// ---------- this-week board (Dashboard) ----------

export function WeekBoard({ monday, reminders, logFor, canTick, busyKey, onToggle, onOpenTasks }) {
  const t = today();
  const [filter, setFilter] = useState('all'); // all | todo | done
  const days = weekDays(monday);
  const byDay = tasksByDay(reminders, logFor, days[0], days[6]);
  const all = days.flatMap((iso) => (byDay.get(iso) || []).map((task) => ({ task, iso })));
  const done = all.filter((x) => x.task.log).length;
  const overdue = all.filter((x) => taskStatus(x.task, x.iso) === 'overdue').length;
  const todo = all.length - done;
  const pct = all.length ? Math.round((100 * done) / all.length) : 0;
  const keep = (task) => filter === 'all' || (filter === 'done' ? !!task.log : !task.log);
  const visibleDays = days.filter((iso) => (byDay.get(iso) || []).some(keep) || (filter === 'all'));

  return (
    <div className="bg-white rounded-lg shadow p-4 md:p-6 mb-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h3 className="text-xl font-bold">This week <span className="text-gray-500 font-normal text-base">· {weekRange(monday)}</span></h3>
        <button onClick={onOpenTasks} className="text-green-700 font-semibold text-sm">Open calendar →</button>
      </div>

      {all.length === 0 ? <p className="text-gray-500">Nothing planned this week.</p> : (
        <>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden mb-2" aria-label={`${pct}% done`}>
            <div className="h-full bg-green-600" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
            <Badge tone="green">{done} done</Badge>
            <Badge tone="orange">{todo} not done</Badge>
            {overdue > 0 && <Badge tone="red">{overdue} overdue</Badge>}
            <span className="text-gray-500">({pct}% of {all.length})</span>
            <span className="ml-auto flex gap-1">
              {[['all', 'All'], ['todo', 'Not done'], ['done', 'Done']].map(([k, label]) => (
                <SmallButton key={k} tone={filter === k ? 'green' : 'gray'} onClick={() => setFilter(k)}>{label}</SmallButton>
              ))}
            </span>
          </div>

          <div className="divide-y">
            {visibleDays.map((iso) => {
              const tasks = (byDay.get(iso) || []).filter(keep);
              const dayAll = byDay.get(iso) || [];
              const dayDone = dayAll.filter((x) => x.log).length;
              return (
                <div key={iso} className={`py-2 ${iso === t ? 'bg-green-50 -mx-2 px-2 rounded' : ''}`}>
                  <div className="flex items-baseline justify-between">
                    <p className={`font-bold text-sm ${iso === t ? 'text-green-700' : 'text-gray-700'}`}>
                      {prettyDate(iso)}{iso === t && ' · today'}
                    </p>
                    <span className="text-xs text-gray-500">{dayAll.length ? `${dayDone}/${dayAll.length} done` : 'nothing planned'}</span>
                  </div>
                  {tasks.map((task) => {
                    const status = taskStatus(task, iso);
                    return (
                      <div key={task.reminder_id} className="flex items-center gap-2 py-1">
                        <StatusMark
                          status={status}
                          onClick={() => onToggle(task, iso)}
                          disabled={!canTick || iso > t || busyKey === `${task.reminder_id}|${iso}`}
                          label={`${task.log ? 'Un-tick' : 'Mark done'}: ${task.reminder_title}`}
                        />
                        <button onClick={onOpenTasks} className={`text-left text-sm flex-1 min-w-0 ${task.log ? 'line-through text-gray-400' : status === 'overdue' ? 'text-red-700 font-medium' : 'text-gray-800'}`}>
                          {timeStr(task.due_time) && <span className="text-gray-500">{timeStr(task.due_time)} </span>}
                          {task.reminder_title}
                        </button>
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${DOT[task.priority] || 'bg-gray-400'}`} title={task.priority} />
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {filter !== 'all' && visibleDays.length === 0 && (
              <p className="py-3 text-sm text-gray-500">{filter === 'done' ? 'Nothing ticked off yet this week.' : 'Everything planned this week is done. 👍'}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
