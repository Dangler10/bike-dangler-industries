// ============================================
// SHARED DATA HELPERS
// ============================================

import { supabase } from './supabaseClient';
import { today, toDate, addDays, startOfWeek } from './components';

// The app runs a single farm. Cached after the first successful load.
let farmPromise = null;
export function loadFarm() {
  if (!farmPromise) {
    farmPromise = supabase
      .from('farms').select('farm_id, name').limit(1).maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          farmPromise = null;
          throw new Error(error?.message || 'No farm found yet. Run supabase/02_poultry_and_farm_setup.sql in Supabase.');
        }
        return data;
      });
  }
  return farmPromise;
}

export function resetFarmCache() {
  farmPromise = null;
}

export async function loadPeople() {
  const { data } = await supabase
    .from('users').select('user_id, email, full_name, role').order('email');
  return (data || []).filter((p) => p.role !== 'PENDING');
}

export const personName = (p) => (p ? p.full_name || p.email.split('@')[0] : '—');

// ---------- tasks (reminders) ----------
// A reminder is a task. ONCE = on due_date; DAILY from due_date on;
// WEEKLY on due_date's weekday; MONTHLY on due_date's day of month.

export function occursOn(r, iso) {
  if (r.status !== 'ACTIVE' || !r.due_date || iso < r.due_date) return false;
  switch (r.frequency) {
    case 'DAILY':
      return true;
    case 'WEEKLY':
      return toDate(iso).getDay() === toDate(r.due_date).getDay();
    case 'MONTHLY': {
      const d = toDate(iso);
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      return d.getDate() === Math.min(toDate(r.due_date).getDate(), lastDay);
    }
    default: // ONCE (or not set)
      return iso === r.due_date;
  }
}

const isOnce = (r) => !r.frequency || r.frequency === 'ONCE';

// Loads tasks plus the completions needed to show `fromIso`..`toIso`.
// Returns { reminders, logs, isDone(reminder, iso) }.
export async function loadTasks(farmId, fromIso, toIso = fromIso) {
  const { data: reminders, error } = await supabase
    .from('reminders').select('*').eq('farm_id', farmId).order('due_time', { ascending: true });
  if (error) throw new Error(error.message);

  const onceIds = (reminders || []).filter(isOnce).map((r) => r.reminder_id);
  const [recent, once] = await Promise.all([
    supabase.from('task_logs').select('task_id, reminder_id, completed_date, completed_by')
      .gte('completed_date', fromIso).lte('completed_date', toIso),
    onceIds.length
      ? supabase.from('task_logs').select('task_id, reminder_id, completed_date, completed_by').in('reminder_id', onceIds)
      : Promise.resolve({ data: [] }),
  ]);
  const logs = [...(recent.data || []), ...(once.data || [])];
  const key = (id, iso) => `${id}|${iso}`;
  const doneOn = new Map(logs.map((l) => [key(l.reminder_id, l.completed_date), l]));
  const doneEver = new Map(logs.map((l) => [l.reminder_id, l]));

  return {
    reminders: reminders || [],
    // One-off tasks count as done whenever they were ticked; repeating ones per day.
    logFor: (r, iso) => (isOnce(r) ? doneEver.get(r.reminder_id) : doneOn.get(key(r.reminder_id, iso))) || null,
  };
}

// Tasks to show on a given day: everything due that day, plus (for today's
// checklist) one-off tasks from earlier days that were never ticked.
export function tasksForDay(reminders, logFor, iso, { carryOverdue = true } = {}) {
  return reminders
    .filter((r) => occursOn(r, iso) || (carryOverdue && isOnce(r) && r.status === 'ACTIVE' && r.due_date < iso && iso === today() && !logFor(r, iso)))
    .map((r) => ({ ...r, log: logFor(r, iso), overdue: isOnce(r) && r.due_date < iso }));
}

export const PRIORITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export const sortTasks = (tasks) =>
  [...tasks].sort((a, b) =>
    (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9) ||
    String(a.due_time || '99').localeCompare(String(b.due_time || '99')));

// Every day from fromIso to toIso with that day's tasks (priority/time order).
// Returns a Map: iso -> tasks[]. Overdue one-offs stay on their own day.
export function tasksByDay(reminders, logFor, fromIso, toIso) {
  const out = new Map();
  for (let d = fromIso; d <= toIso; d = addDays(d, 1)) {
    out.set(d, sortTasks(tasksForDay(reminders, logFor, d, { carryOverdue: false })));
  }
  return out;
}

// The 7 days (Monday..Sunday) of the week containing iso.
export const weekDays = (iso) => {
  const monday = startOfWeek(iso);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
};

// done / overdue (past and not ticked) / todo (today or later)
export const taskStatus = (task, iso) => (task.log ? 'done' : iso < today() ? 'overdue' : 'todo');

// Tick or un-tick a task for a day. Returns an error message, or null.
export async function toggleTaskDone(task, iso, userId) {
  const { error } = task.log
    ? await supabase.from('task_logs').delete().eq('task_id', task.log.task_id)
    : await supabase.from('task_logs').insert({ reminder_id: task.reminder_id, completed_date: iso, completed_by: userId });
  return error ? error.message : null;
}

// ---------- equipment ----------

export function maintenanceStatus(e) {
  if (e.current_status === 'RETIRED') return { label: 'Retired', tone: 'gray', rank: 5 };
  if (e.current_status === 'BROKEN') return { label: 'Broken', tone: 'red', rank: 0 };
  if (!e.next_maintenance_date) return { label: 'No schedule', tone: 'gray', rank: 4 };
  const t = today();
  if (e.next_maintenance_date < t) return { label: 'Overdue', tone: 'red', rank: 1 };
  if (e.next_maintenance_date <= addDays(t, 7)) return { label: 'Due this week', tone: 'orange', rank: 2 };
  return { label: 'Upcoming', tone: 'green', rank: 3 };
}
