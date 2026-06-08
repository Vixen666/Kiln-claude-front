import React, { useEffect, useState } from 'react'
import { useLang } from '../i18n/index.jsx'
import Modal from '../components/Modal'
import { Button, FormField, Input, Select, Textarea, SectionDivider } from '../components/UI'

const TEMPLATE_DEFAULTS = {
  name: '', description: '',
  target_material: '', cone: '', notes: '',
}

const emptySegment = (prev) => ({
  position: 0,
  label: '',
  segment_type: 'ramp',
  start_temp: prev ? prev.end_temp : 20,
  end_temp:   prev ? prev.end_temp + 100 : 120,
  duration_minutes: 60,
  hold_minutes: 0,
  notify_on_complete: false,
})

export default function TemplateModal({ open, onClose, onSave, initial }) {
  const { t } = useLang()
  const [form, setForm]       = useState(TEMPLATE_DEFAULTS)
  const [segments, setSegments] = useState([])

  useEffect(() => {
    if (open) {
      setForm({ ...TEMPLATE_DEFAULTS, ...(initial || {}) })
      setSegments((initial?.segments || []).map(s => ({ ...s })))
    }
  }, [open, initial])

  const setF = key => e => setForm(f => ({ ...f, [key]: e.target.value }))

  function addSegment() {
    const prev = segments[segments.length - 1]
    setSegments(s => [...s, emptySegment(prev)])
  }

  function removeSegment(i) {
    setSegments(s => s.filter((_, idx) => idx !== i).map((seg, idx) => ({ ...seg, position: idx })))
  }

  function updateSegment(i, key, value) {
    setSegments(s => s.map((seg, idx) => idx === i ? { ...seg, [key]: value } : seg))
  }

  async function handleSave() {
    if (!form.name.trim()) return alert(t('name') + ' krävs')
    const data = {
      ...form,
      segments: segments.map((s, i) => ({
        ...s,
        position: i,
        start_temp: +s.start_temp,
        end_temp: +s.end_temp,
        duration_minutes: +s.duration_minutes,
        hold_minutes: +s.hold_minutes,
      })),
    }
    onSave(data)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial?.id ? t('edit_template') : t('new_template')}
      width={820}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave}>Save Template</Button>
        </>
      }
    >
      {/* ── Info fields ── */}
      <div style={styles.grid}>
        <FormField label="Name *" span={2}>
          <Input value={form.name} onChange={setF('name')} placeholder="Stoneware Cone 6" />
        </FormField>
        <FormField label="Target Material">
          <Input value={form.target_material} onChange={setF('target_material')} placeholder="Stoneware, Porcelain…" />
        </FormField>
        <FormField label="Cone / Target Temp">
          <Input value={form.cone} onChange={setF('cone')} placeholder="Cone 6 / 1220°C" />
        </FormField>
        <FormField label="Notes" span={2}>
          <Textarea value={form.notes} onChange={setF('notes')} placeholder="Firing notes…" style={{ minHeight: 60 }} />
        </FormField>
      </div>

      {/* ── Segments ── */}
      <SectionDivider>Firing Curve Segments</SectionDivider>

      <div style={{ overflowX: 'auto', marginTop: 4 }}>
        <table style={styles.table}>
          <thead>
            <tr>
              {[t('segment_pos'), t('segment_label'), t('segment_type'), t('segment_start'), t('segment_end'), t('segment_ramp_min'), t('segment_hold_min'), t('segment_notify'), ''].map(h => (
                <th key={h} style={styles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {segments.length === 0 ? (
              <tr><td colSpan={8} style={styles.emptyCell}>No segments yet — add one below</td></tr>
            ) : segments.map((s, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={styles.td}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-3)' }}>{i + 1}</span>
                </td>
                <td style={styles.td}>
                  <Input value={s.label} onChange={e => updateSegment(i, 'label', e.target.value)} placeholder={t('segment_label_ph')} style={{ minWidth: 110, fontSize: 12 }} />
                </td>
                <td style={styles.td}>
                  <Select value={s.segment_type} onChange={e => updateSegment(i, 'segment_type', e.target.value)} style={{ minWidth: 76, fontSize: 12 }}>
                    <option value="ramp">{t('segment_ramp')}</option>
                    <option value="hold">{t('segment_hold')}</option>
                  </Select>
                </td>
                <td style={styles.td}>
                  <Input type="number" value={s.start_temp} onChange={e => updateSegment(i, 'start_temp', e.target.value)} style={{ width: 72, fontSize: 12 }} />
                </td>
                <td style={styles.td}>
                  <Input type="number" value={s.end_temp} onChange={e => updateSegment(i, 'end_temp', e.target.value)} style={{ width: 72, fontSize: 12 }} />
                </td>
                <td style={styles.td}>
                  <Input type="number" value={s.duration_minutes} onChange={e => updateSegment(i, 'duration_minutes', e.target.value)} style={{ width: 72, fontSize: 12 }} />
                </td>
                <td style={styles.td}>
                  <Input type="number" value={s.hold_minutes} onChange={e => updateSegment(i, 'hold_minutes', e.target.value)} style={{ width: 72, fontSize: 12 }} />
                </td>
                <td style={{ ...styles.td, textAlign: 'center' }}>
                  <button
                    onClick={() => updateSegment(i, 'notify_on_complete', !s.notify_on_complete)}
                    title={s.notify_on_complete ? 'Notification enabled' : 'Click to enable notification'}
                    style={{
                      width: 28, height: 28, borderRadius: '50%', border: 'none',
                      cursor: 'pointer', fontSize: 14,
                      background: s.notify_on_complete ? '#dbeafe' : 'var(--color-background-secondary)',
                      transition: 'background .15s',
                    }}
                  >
                    🔔
                  </button>
                  {s.notify_on_complete && (
                    <div style={{ fontSize: 9, color: '#1e6fbf', marginTop: 2, fontWeight: 500 }}>ON</div>
                  )}
                </td>
                <td style={styles.td}>
                  <Button size="sm" variant="danger" onClick={() => removeSegment(i)}>✕</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10 }}>
        <Button size="sm" variant="ghost" onClick={addSegment}>+ Add Segment</Button>
      </div>
    </Modal>
  )
}

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px 16px',
    marginBottom: 8,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  th: {
    padding: '6px 8px',
    fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '.8px', color: 'var(--text-3)',
    textAlign: 'left', borderBottom: '2px solid var(--border)',
    background: 'var(--surface-alt)',
    whiteSpace: 'nowrap',
  },
  td: { padding: '5px 4px', verticalAlign: 'middle' },
  emptyCell: {
    padding: '20px 8px', color: 'var(--text-3)', fontSize: 12, textAlign: 'center',
  },
}
