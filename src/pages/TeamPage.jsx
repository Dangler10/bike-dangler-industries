// ============================================
// TEAM PAGE (owner only) - approve sign-ups and set roles
// ============================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { ErrorBox } from '../components';

const ROLE_INFO = {
  OWNER: 'Full access',
  PARTNER: 'Sees everything incl. finances, changes nothing',
  WORKER: 'Sees farm activity, adds daily logs, no finances',
  PENDING: 'No access until approved',
};

export default function TeamPage({ currentUser }) {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    loadPeople();
  }, []);

  const loadPeople = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('users')
      .select('user_id, email, full_name, role, profit_share_pct, created_at')
      .order('created_at', { ascending: true });
    if (error) setErrorMsg(error.message);
    else setPeople(data || []);
    setLoading(false);
  };

  const setRole = async (person, role) => {
    if (person.role === role) return;
    if (role === 'OWNER' && !window.confirm(`Give ${person.email} full owner access?`)) return;
    setSavingId(person.user_id);
    setErrorMsg('');
    const { error } = await supabase.from('users').update({ role }).eq('user_id', person.user_id);
    setSavingId(null);
    if (error) setErrorMsg(error.message);
    else loadPeople();
  };

  const setShare = async (person, value) => {
    const pct = value === '' ? null : Number(value);
    if (pct === (person.profit_share_pct == null ? null : Number(person.profit_share_pct))) return;
    if (pct !== null && (pct < 0 || pct > 100)) {
      setErrorMsg('Profit share must be between 0 and 100%.');
      return;
    }
    setSavingId(person.user_id);
    setErrorMsg('');
    const { error } = await supabase.from('users').update({ profit_share_pct: pct }).eq('user_id', person.user_id);
    setSavingId(null);
    if (error) setErrorMsg(error.message);
    else loadPeople();
  };

  const pending = people.filter((p) => p.role === 'PENDING');

  return (
    <div className="p-4 md:p-6">
      <h2 className="text-3xl font-bold text-gray-800 mb-2">Team</h2>
      <p className="text-gray-600 mb-6">
        Anyone can sign up, but they see nothing until you give them a role here.
      </p>

      <ErrorBox message={errorMsg} />

      {pending.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-6 text-sm text-yellow-800">
          {pending.length} {pending.length === 1 ? 'person is' : 'people are'} waiting for approval.
        </div>
      )}

      <div className="bg-white rounded-lg shadow divide-y">
        {loading ? (
          <p className="p-6 text-gray-500">Loading...</p>
        ) : (
          people.map((p) => {
            const isMe = p.user_id === currentUser.id;
            return (
              <div key={p.user_id} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 truncate">
                    {p.full_name || p.email} {isMe && <span className="text-gray-500 font-normal">(you)</span>}
                  </p>
                  {p.full_name && <p className="text-sm text-gray-600 truncate">{p.email}</p>}
                  <p className="text-xs text-gray-500">{ROLE_INFO[p.role]}</p>
                </div>
                {p.role === 'PARTNER' && (
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    Profit share
                    <input
                      type="number" min="0" max="100" step="0.5"
                      defaultValue={p.profit_share_pct == null ? '' : Number(p.profit_share_pct)}
                      key={`${p.user_id}-${p.profit_share_pct}`}
                      onBlur={(e) => setShare(p, e.target.value)}
                      disabled={savingId === p.user_id}
                      className="w-20 border border-gray-300 rounded px-2 py-2"
                      aria-label={`Profit share for ${p.email}`}
                    />
                    %
                  </label>
                )}
                <select
                  value={p.role}
                  disabled={isMe || savingId === p.user_id}
                  onChange={(e) => setRole(p, e.target.value)}
                  className={`border rounded px-3 py-2 font-semibold ${
                    p.role === 'PENDING' ? 'border-yellow-400 bg-yellow-50' : 'border-gray-300'
                  }`}
                  title={isMe ? "You can't change your own role" : ''}
                >
                  {Object.keys(ROLE_INFO).map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
