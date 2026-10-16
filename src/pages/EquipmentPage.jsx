// ============================================
// EQUIPMENT - maintenance schedule, service log, history
// Needs supabase/03_operations.sql (log_equipment_service).
// ============================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { loadFarm, maintenanceStatus } from '../data';
import {
  Modal, ErrorBox, Field, FormButtons, inputClass, today, daysBetween, money,
  PageHeader, PrimaryButton, SmallButton, Badge, Empty, MiniStat,
} from '../components';

export default function EquipmentPage({ role }) {
  const isOwner = role === 'OWNER';
  const canService = role === 'OWNER' || role === 'WORKER';
  const seesMoney = role !== 'WORKER';
  const [farmId, setFarmId] = useState(null);
  const [items, setItems] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [modal, setModal] = useState(null); // { type: 'edit'|'service', item }
  const [expandedId, setExpandedId] = useState(null);
  const [showRetired, setShowRetired] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setErrorMsg('');
    try {
      const farm = await loadFarm();
      setFarmId(farm.farm_id);
      const { data, error } = await supabase.from('equipment').select('*').eq('farm_id', farm.farm_id).order('equipment_name');
      if (error) throw new Error(error.message);
      setItems(data || []);
    } catch (e) {
      setErrorMsg(e.message);
      setItems([]);
    }
  };

  const closeModal = (changed) => {
    setModal(null);
    if (changed) load();
  };

  const withStatus = (items || []).map((e) => ({ ...e, ms: maintenanceStatus(e) }))
    .sort((a, b) => a.ms.rank - b.ms.rank || String(a.next_maintenance_date).localeCompare(String(b.next_maintenance_date)));
  const shown = withStatus.filter((e) => showRetired || e.current_status !== 'RETIRED');
  const retired = withStatus.length - withStatus.filter((e) => e.current_status !== 'RETIRED').length;
  const overdue = withStatus.filter((e) => e.ms.label === 'Overdue' || e.ms.label === 'Broken').length;
  const dueWeek = withStatus.filter((e) => e.ms.label === 'Due this week').length;

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Equipment">
        {isOwner && <PrimaryButton onClick={() => setModal({ type: 'edit' })} disabled={!farmId}>+ Add Equipment</PrimaryButton>}
      </PageHeader>
      <ErrorBox message={errorMsg} />

      {!items ? <p className="text-gray-500">Loading...</p> : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <MiniStat label="Equipment" value={withStatus.length - retired} tone="info" />
            <MiniStat label="Overdue / broken" value={overdue} tone={overdue ? 'bad' : 'ok'} />
            <MiniStat label="Due this week" value={dueWeek} tone={dueWeek ? 'warn' : 'ok'} />
          </div>

          {shown.length === 0 ? (
            <Empty>No equipment yet.{isOwner && ' Add pumps, motors, tractors etc. with a service interval to get reminders.'}</Empty>
          ) : (
            <div className="space-y-4">
              {shown.map((item) => {
                const days = item.next_maintenance_date ? daysBetween(today(), item.next_maintenance_date) : null;
                return (
                  <div key={item.equipment_id} className="bg-white rounded-lg shadow">
                    <div className="p-4 md:p-6">
                      <div className="flex flex-wrap justify-between items-start gap-2">
                        <div>
                          <h3 className="text-lg font-bold">{item.equipment_name}</h3>
                          <p className="text-gray-600 text-sm">
                            {[item.equipment_type, item.location, item.maintenance_frequency_months && `service every ${item.maintenance_frequency_months} month${item.maintenance_frequency_months === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <Badge tone={item.ms.tone}>{item.ms.label}</Badge>
                      </div>
                      <div className="mt-3 text-sm">
                        <span className="text-gray-600">Next service: </span>
                        <span className="font-semibold">
                          {item.next_maintenance_date
                            ? `${item.next_maintenance_date} (${days === 0 ? 'today' : days > 0 ? `in ${days} days` : `${-days} days late`})`
                            : 'not scheduled'}
                        </span>
                        {item.current_status === 'MAINTENANCE' && <span className="ml-2 text-orange-700">· in for maintenance</span>}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-4">
                        {canService && item.current_status !== 'RETIRED' && (
                          <SmallButton tone="blue" onClick={() => setModal({ type: 'service', item })}>Log service</SmallButton>
                        )}
                        {isOwner && <SmallButton onClick={() => setModal({ type: 'edit', item })}>Edit</SmallButton>}
                        <SmallButton onClick={() => setExpandedId(expandedId === item.equipment_id ? null : item.equipment_id)}>
                          {expandedId === item.equipment_id ? 'Hide history' : 'History'}
                        </SmallButton>
                      </div>
                    </div>
                    {expandedId === item.equipment_id && <ServiceHistory equipmentId={item.equipment_id} seesMoney={seesMoney} />}
                  </div>
                );
              })}
            </div>
          )}
          {retired > 0 && (
            <button onClick={() => setShowRetired(!showRetired)} className="mt-6 text-green-700 font-semibold">
              {showRetired ? 'Hide retired' : `Show retired (${retired})`}
            </button>
          )}
        </>
      )}

      {modal?.type === 'edit' && <EquipmentModal farmId={farmId} item={modal.item} onClose={closeModal} />}
      {modal?.type === 'service' && <ServiceModal item={modal.item} isOwner={isOwner} onClose={closeModal} />}
    </div>
  );
}

function ServiceHistory({ equipmentId, seesMoney }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    supabase.from('maintenance_logs').select('*').eq('equipment_id', equipmentId)
      .order('maintenance_date', { ascending: false })
      .then(({ data }) => setRows(data || []));
  }, [equipmentId]);
  if (!rows) return <p className="px-6 pb-4 text-gray-500">Loading...</p>;
  return (
    <div className="border-t px-4 md:px-6 py-4">
      {rows.length === 0 ? <p className="text-sm text-gray-500">No services logged yet.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500">
              <tr><th className="py-1 pr-4">Date</th><th className="pr-4">Work</th>{seesMoney && <th className="pr-4">Cost</th>}<th>Notes</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.log_id} className="border-t align-top">
                  <td className="py-1 pr-4 whitespace-nowrap">{r.maintenance_date}</td>
                  <td className="pr-4">{r.maintenance_type || '—'}</td>
                  {seesMoney && <td className="pr-4">{r.cost != null ? money(r.cost) : '—'}</td>}
                  <td className="text-gray-700">{r.notes || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EquipmentModal({ farmId, item, onClose }) {
  const editing = !!item;
  const [form, setForm] = useState({
    equipment_name: item?.equipment_name || '',
    equipment_type: item?.equipment_type || '',
    location: item?.location || '',
    purchase_date: item?.purchase_date || '',
    purchase_cost: item?.purchase_cost != null ? String(Number(item.purchase_cost)) : '',
    maintenance_frequency_months: item?.maintenance_frequency_months != null ? String(item.maintenance_frequency_months) : '',
    next_maintenance_date: item?.next_maintenance_date || '',
    current_status: item?.current_status || 'ACTIVE',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const row = {
      equipment_name: form.equipment_name.trim(),
      equipment_type: form.equipment_type.trim() || null,
      location: form.location.trim() || null,
      purchase_date: form.purchase_date || null,
      purchase_cost: form.purchase_cost === '' ? null : Number(form.purchase_cost),
      maintenance_frequency_months: form.maintenance_frequency_months === '' ? null : parseInt(form.maintenance_frequency_months, 10),
      next_maintenance_date: form.next_maintenance_date || null,
      current_status: form.current_status,
    };
    const { error: saveError } = editing
      ? await supabase.from('equipment').update(row).eq('equipment_id', item.equipment_id)
      : await supabase.from('equipment').insert({ ...row, farm_id: farmId });
    setSaving(false);
    if (saveError) setError(saveError.message);
    else onClose(true);
  };

  return (
    <Modal onClose={() => onClose(false)}>
      <h3 className="text-2xl font-bold mb-4">{editing ? 'Edit Equipment' : 'Add Equipment'}</h3>
      <ErrorBox message={error} />
      <form onSubmit={save} className="space-y-4">
        <Field label="Name">
          <input className={inputClass} placeholder="e.g. Irrigation pump" value={form.equipment_name} onChange={set('equipment_name')} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <input className={inputClass} list="equipment-types" value={form.equipment_type} onChange={set('equipment_type')} />
            <datalist id="equipment-types">
              {['PUMP', 'MOTOR', 'TRACTOR', 'GENERATOR', 'SPRAYER', 'TOOL', 'VEHICLE'].map((x) => <option key={x} value={x} />)}
            </datalist>
          </Field>
          <Field label="Where">
            <input className={inputClass} value={form.location} onChange={set('location')} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Service every (months)">
            <input className={inputClass} type="number" min="1" step="1" value={form.maintenance_frequency_months} onChange={set('maintenance_frequency_months')} />
          </Field>
          <Field label="Next service">
            <input className={inputClass} type="date" value={form.next_maintenance_date} onChange={set('next_maintenance_date')} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Bought on">
            <input className={inputClass} type="date" value={form.purchase_date} onChange={set('purchase_date')} />
          </Field>
          <Field label="Cost (USD)">
            <input className={inputClass} type="number" min="0" step="0.01" value={form.purchase_cost} onChange={set('purchase_cost')} />
          </Field>
        </div>
        <Field label="Status">
          <select className={inputClass} value={form.current_status} onChange={set('current_status')}>
            <option value="ACTIVE">Working</option>
            <option value="MAINTENANCE">In for maintenance</option>
            <option value="BROKEN">Broken</option>
            <option value="RETIRED">Retired</option>
          </select>
        </Field>
        <FormButtons saving={saving} onCancel={() => onClose(false)} />
      </form>
    </Modal>
  );
}

function ServiceModal({ item, isOwner, onClose }) {
  const [form, setForm] = useState({ date: today(), type: '', cost: '', notes: '', payment_method: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const { error: rpcError } = await supabase.rpc('log_equipment_service', {
      p_equipment_id: item.equipment_id,
      p_date: form.date,
      p_maintenance_type: form.type.trim() || null,
      p_cost: form.cost === '' ? null : Number(form.cost),
      p_notes: form.notes.trim() || null,
      p_payment_method: form.payment_method.trim() || null,
    });
    setSaving(false);
    if (rpcError) setError(rpcError.message);
    else onClose(true);
  };

  return (
    <Modal onClose={() => onClose(false)}>
      <h3 className="text-2xl font-bold mb-1">Log Service · {item.equipment_name}</h3>
      <p className="text-sm text-gray-600 mb-4">
        {item.maintenance_frequency_months
          ? `Next service will be set ${item.maintenance_frequency_months} month${item.maintenance_frequency_months === 1 ? '' : 's'} after this date.`
          : 'No service interval set, so the next date won\'t change.'}
      </p>
      <ErrorBox message={error} />
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input className={inputClass} type="date" max={today()} value={form.date} onChange={set('date')} required />
          </Field>
          <Field label="Work done">
            <input className={inputClass} placeholder="Oil change, new seal..." value={form.type} onChange={set('type')} />
          </Field>
        </div>
        {isOwner && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cost (USD)" hint="Booked as a Maintenance expense">
              <input className={inputClass} type="number" min="0" step="0.01" value={form.cost} onChange={set('cost')} />
            </Field>
            <Field label="Paid with">
              <input className={inputClass} placeholder="Cash, EcoCash..." value={form.payment_method} onChange={set('payment_method')} />
            </Field>
          </div>
        )}
        <Field label="Notes">
          <textarea className={`${inputClass} h-20`} value={form.notes} onChange={set('notes')} />
        </Field>
        <FormButtons saving={saving} onCancel={() => onClose(false)} label="Save Service" />
      </form>
    </Modal>
  );
}
