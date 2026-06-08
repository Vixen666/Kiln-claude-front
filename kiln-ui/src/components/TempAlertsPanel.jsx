import React, { useState } from 'react'
import { useLang } from '../i18n/index.jsx'
import { burnsApi } from '../lib/api'
import { Button, Card } from '../components/UI'

/**
 * TempAlertsPanel
 * Props:
 *   burnId    — the burn id
 *   alerts    — current list of BurnTempAlertOut
 *   segments  — template segments (for the segment picker labels)
 *   onRefresh — callback to reload the burn
 *   toast     — toast function
 */
export default function TempAlertsPanel({ burnId, alerts = [], segments = [], onRefresh, toast }) {
  const { t } = useLang()
  const [adding, setAdding] = useState(false)
  const [form, setForm]     = useState(emptyForm())

  function emptyForm() {
    return { temperature: '', direction: 'rising', segment_index: '', label: '' }
  }

  const setF = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleAdd() {
    if (!form.temperature) return toast('Temperatur krävs', 'error')
    try {
      await burnsApi.createAlert(burnId, {
        temperature:   +form.temperature,
        direction:     form.direction,
        segment_index: form.segment_index !== '' ? +form.segment_index : null,
        label:         form.label,
      })
      toast(t('temp_alert_added'))
      setForm(emptyForm())
      setAdding(false)
      onRefresh()
    } catch (e) { toast(e.message, 'error') }
  }

  async function handleDelete(alertId) {
    try {
      await burnsApi.deleteAlert(burnId, alertId)
      toast(t('temp_alert_removed'))
      onRefresh()
    } catch (e) { toast(e.message, 'error') }
  }

  async function handleReset(alertId) {
    try {
      await burnsApi.updateAlert(burnId, alertId, { fired: false, fired_at: null })
      toast(t('temp_alert_reset_ok'))
      onRefresh()
    } catch (e) { toast(e.message, 'error') }
  }

  return (
    <Card style={{ marginBottom: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={styles.sectionLabel}>Temperature Alerts</div>
        {!adding && (
          <Button size="sm" variant="primary" onClick={() => setAdding(true)}>+ Add Alert</Button>
        )}
      </div>

      {/* Add form */}
      {adding && (
        <div style={styles.addForm}>
          <div style={styles.formRow}>
            {/* Temperature */}
            <div style={styles.formField}>
              <label style={styles.label}>Temperature °C</label>
              <input
                type="number"
                value={form.temperature}
                onChange={setF('temperature')}
                placeholder="1000"
                style={styles.input}
              />
            </div>

            {/* Direction */}
            <div style={styles.formField}>
              <label style={styles.label}>Direction</label>
              <select value={form.direction} onChange={setF('direction')} style={styles.input}>
                <option value="rising">↑ Rising (going up)</option>
                <option value="falling">↓ Falling (going down)</option>
              </select>
            </div>

            {/* Segment constraint */}
            <div style={styles.formField}>
              <label style={styles.label}>Only in segment</label>
              <select value={form.segment_index} onChange={setF('segment_index')} style={styles.input}>
                <option value="">Any segment</option>
                {segments.map((s, i) => (
                  <option key={i} value={i}>
                    {i + 1}. {s.label || `${s.segment_type} → ${s.end_temp}°C`}
                  </option>
                ))}
              </select>
            </div>

            {/* Label */}
            <div style={{ ...styles.formField, flex: 2 }}>
              <label style={styles.label}>Label (optional)</label>
              <input
                type="text"
                value={form.label}
                onChange={setF('label')}
                placeholder="e.g. Quartz inversion"
                style={styles.input}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <Button variant="primary" size="sm" onClick={handleAdd}>Add</Button>
            <Button variant="ghost" size="sm" onClick={() => { setAdding(false); setForm(emptyForm()) }}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Alert list */}
      {alerts.length === 0 && !adding ? (
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
          No temperature alerts yet. Add one to get notified when the kiln hits a specific temperature.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: adding ? 14 : 0 }}>
          {alerts.map(a => (
            <AlertRow
              key={a.id}
              alert={a}
              segments={segments}
              onDelete={() => handleDelete(a.id)}
              onReset={() => handleReset(a.id)}
            />
          ))}
        </div>
      )}
    </Card>
  )
}

function AlertRow({ alert, segments, onDelete, onReset }) {
  const dirIcon  = alert.direction === 'rising' ? '↑' : '↓'
  const dirColor = alert.direction === 'rising' ? '#dc2626' : '#2563eb'
  const segLabel = alert.segment_index != null && segments[alert.segment_index]
    ? `seg ${alert.segment_index + 1}: ${segments[alert.segment_index].label || segments[alert.segment_index].end_temp + '°C'}`
    : null

  return (
    <div style={{
      ...styles.alertRow,
      opacity: alert.fired ? 0.55 : 1,
      background: alert.fired ? 'var(--color-background-secondary)' : 'var(--color-background-primary)',
    }}>
      {/* Temp + direction */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 500,
          color: alert.fired ? 'var(--color-text-secondary)' : dirColor,
        }}>
          {dirIcon} {alert.temperature}°C
        </span>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {alert.label && (
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
              {alert.label}
            </span>
          )}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            <Chip>{alert.direction === 'rising' ? '↑ rising' : '↓ falling'}</Chip>
            {segLabel && <Chip>🔒 {segLabel}</Chip>}
            {alert.fired && (
              <Chip style={{ background: '#d1fae5', color: '#065f46' }}>
                ✓ fired {alert.fired_at ? fmtTime(alert.fired_at) : ''}
              </Chip>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {alert.fired && (
          <Button size="sm" variant="ghost" onClick={onReset} style={{ fontSize: 11 }}>Reset</Button>
        )}
        <Button size="sm" variant="danger" onClick={onDelete}>✕</Button>
      </div>
    </div>
  )
}

function Chip({ children, style }) {
  return (
    <span style={{
      fontSize: 11, padding: '2px 7px', borderRadius: 99,
      background: 'var(--color-background-secondary)',
      border: '0.5px solid var(--color-border-tertiary)',
      color: 'var(--color-text-secondary)',
      ...style,
    }}>{children}</span>
  )
}

function fmtTime(s) {
  if (!s) return ''
  return 'at ' + new Date(s).toLocaleTimeString('sv-SE').slice(0, 5)
}

const styles = {
  sectionLabel: {
    fontSize: 11, fontWeight: 500, textTransform: 'uppercase',
    letterSpacing: '1px', color: 'var(--color-text-secondary)',
  },
  addForm: {
    background: 'var(--color-background-secondary)',
    borderRadius: 'var(--border-radius-md)',
    padding: '14px',
    marginBottom: 4,
  },
  formRow: {
    display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end',
  },
  formField: {
    display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 120,
  },
  label: {
    fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)',
    letterSpacing: '.3px',
  },
  input: {
    background: 'var(--color-background-primary)',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 'var(--border-radius-md)',
    padding: '7px 10px', fontSize: 13,
    color: 'var(--color-text-primary)',
    fontFamily: 'inherit', outline: 'none', width: '100%',
  },
  alertRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 14px', borderRadius: 'var(--border-radius-md)',
    border: '0.5px solid var(--color-border-tertiary)',
    gap: 12, transition: 'opacity .2s',
  },
}
