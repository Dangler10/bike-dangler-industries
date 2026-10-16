// ============================================
// SHARED UI COMPONENTS
// ============================================

import React from 'react';

export function StatCard({ title, value, icon, color, subtext }) {
  const colorMap = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    red: 'bg-red-50 border-red-200',
    purple: 'bg-purple-50 border-purple-200',
    orange: 'bg-orange-50 border-orange-200',
  };

  return (
    <div className={`${colorMap[color]} border rounded-lg p-6`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-gray-600 text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold mt-2 text-gray-800">{value}</p>
          <p className="text-gray-600 text-sm mt-2">{subtext}</p>
        </div>
        <span className="text-4xl">{icon}</span>
      </div>
    </div>
  );
}

export function Modal({ onClose, children }) {
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

export function ErrorBox({ message }) {
  if (!message) return null;
  return (
    <div className="bg-red-50 border border-red-300 text-red-700 rounded-lg p-3 mb-6 text-sm">
      {message}
    </div>
  );
}

// Labelled form field wrapper.
export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-xs text-gray-500 mt-1">{hint}</span>}
    </label>
  );
}

export const inputClass = 'w-full border border-gray-300 rounded px-3 py-2';

export function FormButtons({ saving, onCancel, label = 'Save' }) {
  return (
    <div className="flex gap-2">
      <button
        type="submit"
        disabled={saving}
        className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white py-2 rounded font-semibold"
      >
        {saving ? 'Saving...' : label}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 rounded font-semibold"
      >
        Cancel
      </button>
    </div>
  );
}

// ---------- dates (all 'YYYY-MM-DD' strings, local time) ----------

export const today = () => new Date().toLocaleDateString('en-CA');

export const toDate = (iso) => new Date(`${iso}T00:00:00`);

export const addDays = (iso, days) => {
  const d = toDate(iso);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-CA');
};

export const daysBetween = (fromIso, toIso) => Math.round((toDate(toIso) - toDate(fromIso)) / 86400000);

// Monday of the week containing `iso`.
export const startOfWeek = (iso) => {
  const day = toDate(iso).getDay(); // 0 = Sunday
  return addDays(iso, day === 0 ? -6 : 1 - day);
};

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const prettyDate = (iso) =>
  iso ? toDate(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '—';

// ---------- small shared bits ----------

export function PageHeader({ title, children }) {
  return (
    <div className="flex flex-wrap gap-3 justify-between items-center mb-6">
      <h2 className="text-3xl font-bold text-gray-800">{title}</h2>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function PrimaryButton({ children, className = '', ...props }) {
  return (
    <button
      {...props}
      className={`bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg font-semibold transition ${className}`}
    >
      {children}
    </button>
  );
}

export function SmallButton({ tone = 'gray', children, ...props }) {
  const tones = {
    gray: 'bg-gray-100 hover:bg-gray-200 text-gray-800',
    green: 'bg-green-600 hover:bg-green-700 text-white',
    blue: 'bg-blue-600 hover:bg-blue-700 text-white',
    red: 'bg-red-50 hover:bg-red-100 text-red-700',
  };
  return (
    <button {...props} className={`${tones[tone]} px-3 py-2 rounded font-semibold text-sm disabled:opacity-50`}>
      {children}
    </button>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="flex gap-1 mb-6 border-b border-gray-300 overflow-x-auto">
      {tabs.map(([key, label]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`px-4 py-2 font-semibold whitespace-nowrap -mb-px border-b-2 ${
            value === key ? 'border-green-600 text-green-700' : 'border-transparent text-gray-600 hover:text-gray-800'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function MiniStat({ label, value, tone = 'ok', sub }) {
  const tones = {
    ok: 'bg-green-50 border-green-200',
    warn: 'bg-orange-50 border-orange-200',
    bad: 'bg-red-50 border-red-200',
    info: 'bg-blue-50 border-blue-200',
  };
  return (
    <div className={`${tones[tone]} border rounded-lg p-4`}>
      <p className="text-gray-600 text-sm">{label}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
    </div>
  );
}

export function Badge({ tone = 'gray', children }) {
  const tones = {
    gray: 'bg-gray-100 text-gray-700',
    green: 'bg-green-100 text-green-700',
    orange: 'bg-orange-100 text-orange-700',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-blue-100 text-blue-700',
    yellow: 'bg-yellow-100 text-yellow-800',
  };
  return <span className={`${tones[tone]} px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap`}>{children}</span>;
}

export function Empty({ children }) {
  return <div className="bg-white rounded-lg shadow p-6 text-gray-600">{children}</div>;
}

export const money = (n) => {
  const v = Number(n || 0);
  return `${v < 0 ? '-' : ''}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
