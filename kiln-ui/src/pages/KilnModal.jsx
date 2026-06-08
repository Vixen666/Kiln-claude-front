import React, { useEffect, useState } from 'react'
import { useLang } from '../i18n/index.jsx'
import Modal from '../components/Modal'
import { Button, FormField, Input, Select, SectionDivider } from '../components/UI'

const DEFAULTS = {
  name: '', description: '',
  pid_kp: 1.0, pid_ki: 0.1, pid_kd: 0.05,
  temp_min: 0, temp_max: 1300,
  safety_cutoff_temp: 1350, max_duty_cycle: 100,
  pid_window_below: 0, pid_window_above: 0,
  catch_up_enabled: true, catch_up_max_error: 25,
  sensor_samples: 10, sensor_trim_pct: 20,
  pin_heater: 17,
  pin_safety: '', pin_sensor: 8, pin_fan: '', pin_power: '',
  pwm_frequency: 50,
  sensor_type: 'MAX31856', tc_type: 'K', sensor_offset: 0.0,
  control_interval_ms: 1000, watchdog_timeout_s: 30,
  log_level: 'INFO',
}

export default function KilnModal({ open, onClose, onSave, initial }) {
  const { t } = useLang()
  const [form, setForm] = useState(DEFAULTS)

  useEffect(() => {
    if (open) setForm({ ...DEFAULTS, ...(initial || {}) })
  }, [open, initial])

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

  async function handleSave() {
    if (!form.name.trim()) return alert(t('name') + ' krävs')
    const data = {
      ...form,
      pid_kp:   +form.pid_kp,  pid_ki: +form.pid_ki, pid_kd: +form.pid_kd,
      temp_min: +form.temp_min, temp_max: +form.temp_max,
      safety_cutoff_temp: +form.safety_cutoff_temp,
      max_duty_cycle:   +form.max_duty_cycle,
      pid_window_below:   +form.pid_window_below,
      pid_window_above:   +form.pid_window_above,
      catch_up_enabled:   form.catch_up_enabled,
      catch_up_max_error: +form.catch_up_max_error,
      sensor_samples:     +form.sensor_samples,
      sensor_trim_pct:    +form.sensor_trim_pct,
      pin_heater: +form.pin_heater,
      pin_safety: form.pin_safety !== '' ? +form.pin_safety : null,
      pin_sensor: +form.pin_sensor,
      pin_fan:   form.pin_fan   !== '' ? +form.pin_fan   : null,
      pin_power: form.pin_power !== '' ? +form.pin_power : null,
      pwm_frequency: +form.pwm_frequency,
      sensor_offset: +form.sensor_offset,
      control_interval_ms: +form.control_interval_ms,
      watchdog_timeout_s: +form.watchdog_timeout_s,
      log_level: form.log_level,
    }
    onSave(data)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial?.id ? t('edit') + ' ' + t('nav_kilns').slice(0,-1) : t('kilns_new').replace('+ ', '')}
      width={640}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave}>Save Kiln</Button>
        </>
      }
    >
      <div style={styles.grid}>

        {/* ── Identity ── */}
        <FormField label="Name *" span={2}>
          <Input value={form.name} onChange={set('name')} placeholder="Studio Kiln #1" />
        </FormField>
        <FormField label="Description" span={2}
          hint="Optional free-text note about this kiln — model, location, etc.">
          <Input value={form.description} onChange={set('description')} placeholder="e.g. Skutt KM-1027, studio shelf B" />
        </FormField>

        {/* ── PID Tuning ── */}
        <SectionDivider>PID Tuning</SectionDivider>

        <FormField label="Kp — Proportional"
          hint={t('kiln_kp_hint')}>
          <Input type="number" step="0.01" value={form.pid_kp} onChange={set('pid_kp')} />
        </FormField>
        <FormField label="Ki — Integral"
          hint={t('kiln_ki_hint')}>
          <Input type="number" step="0.001" value={form.pid_ki} onChange={set('pid_ki')} />
        </FormField>
        <FormField label="Kd — Derivative"
          hint={t('kiln_kd_hint')}>
          <Input type="number" step="0.001" value={form.pid_kd} onChange={set('pid_kd')} />
        </FormField>
        <FormField label="Control Interval (ms)"
          hint={t('kiln_interval_hint')}>
          <Input type="number" min="100" value={form.control_interval_ms} onChange={set('control_interval_ms')} />
        </FormField>

        {/* ── Temperature Limits ── */}
        <SectionDivider>Temperature Limits (°C)</SectionDivider>

        <FormField label="Min Temp °C"
          hint="Lowest temperature the kiln is expected to operate at. Used for sanity checks. Usually 0 or room temp.">
          <Input type="number" value={form.temp_min} onChange={set('temp_min')} />
        </FormField>
        <FormField label="Max Temp °C"
          hint={t('kiln_temp_max_hint')}>
          <Input type="number" value={form.temp_max} onChange={set('temp_max')} />
        </FormField>
        <FormField label="Safety Cutoff °C"
          hint={t('kiln_cutoff_hint')}>
          <Input type="number" value={form.safety_cutoff_temp} onChange={set('safety_cutoff_temp')} />
        </FormField>
        <FormField label="Max Duty Cycle %"
          hint="Caps the maximum heater power output. 100% = full power allowed. Lower this to protect elements or reduce overshoot on a powerful kiln.">
          <Input type="number" min="0" max="100" value={form.max_duty_cycle} onChange={set('max_duty_cycle')} />
        </FormField>

        {/* ── Control Window ── */}
        <SectionDivider>Control Window (Bang-bang assist)</SectionDivider>

        <FormField label="Full power below °C"
          hint="If actual temp is more than this many °C below the setpoint, ignore PID and run at full power. Good for fast initial ramps. 0 = disabled. Typical: 50°C.">
          <Input type="number" min="0" step="1" value={form.pid_window_below} onChange={set('pid_window_below')} />
        </FormField>
        <FormField label="Zero power above °C"
          hint="If actual temp is more than this many °C above the setpoint, cut power completely and reset the integral. Prevents overshoot. 0 = disabled. Typical: 10–20°C.">
          <Input type="number" min="0" step="1" value={form.pid_window_above} onChange={set('pid_window_above')} />
        </FormField>

        {/* ── Catch-up ── */}
        <SectionDivider>Catch-up</SectionDivider>

        <FormField
          label="Aktivera catch-up"
          hint="Om ugnen är mer än max-felet från börvärdet pausas schemat tills den hinner ikapp — åt båda hållen (för varm och för kall)."
          span={2}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, catch_up_enabled: !f.catch_up_enabled }))}
              style={{
                width: 44, height: 24, borderRadius: 99, border: 'none',
                background: form.catch_up_enabled ? '#1e6fbf' : '#d1d5db',
                cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0,
              }}
            >
              <span style={{
                position: 'absolute', top: 3,
                left: form.catch_up_enabled ? 23 : 3,
                width: 18, height: 18, borderRadius: '50%',
                background: '#fff', transition: 'left .2s',
                boxShadow: '0 1px 3px rgba(0,0,0,.2)',
              }} />
            </button>
            <span style={{ fontSize: 13, color: form.catch_up_enabled ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
              {form.catch_up_enabled ? 'Aktiverat' : 'Inaktiverat'}
            </span>
          </div>
        </FormField>

        {form.catch_up_enabled && (
          <FormField
            label="Max avvikelse °C"
            hint="Schemat pausas om ugnen avviker mer än detta från börvärdet. Typiskt 20–30°C."
          >
            <Input type="number" min="1" step="1" value={form.catch_up_max_error} onChange={set('catch_up_max_error')} />
          </FormField>
        )}

        {/* ── Sensor averaging ── */}
        <SectionDivider>Sensormedelvärde (trimmat)</SectionDivider>

        <FormField
          label="Antal mätningar"
          hint="Antal givarmätningar per cykel. Fler = stabilare mot störningar men lite långsammare. Typiskt 5–15."
        >
          <Input type="number" min="1" max="50" value={form.sensor_samples} onChange={set('sensor_samples')} />
        </FormField>
        <FormField
          label="Trim-procent %"
          hint="Kastar denna procent från varje ände. 20% = tar bort 20% högst och 20% lägst, medelvärde på resten. Effektivt mot EMI-spikes."
        >
          <Input type="number" min="0" max="40" step="5" value={form.sensor_trim_pct} onChange={set('sensor_trim_pct')} />
        </FormField>

        {/* ── GPIO Pins ── */}
        <SectionDivider>Raspberry Pi GPIO Pins (BCM numbering)</SectionDivider>

        <FormField label="Heater Relay Pin"
          hint={t('kiln_pin_heater_hint')}>
          <Input type="number" value={form.pin_heater} onChange={set('pin_heater')} />
        </FormField>
        <FormField
          label="Failsafe SSR-pinn"
          hint="Valfri. BCM GPIO för en failsafe SSR i serie med primären. Normalt HÖG (leder). Dras LÅG vid säkerhetsavstängning — bryter kretsen även om primär SSR fastnat i slutet läge.">
          <Input type="number" value={form.pin_safety} onChange={set('pin_safety')} placeholder="— inte installerad —" />
        </FormField>
        <FormField label="Sensor CS Pin"
          hint={t('kiln_pin_sensor_hint')}>
          <Input type="number" value={form.pin_sensor} onChange={set('pin_sensor')} />
        </FormField>
        <FormField label="Fan Pin"
          hint={t('kiln_pin_fan_hint')}>
          <Input type="number" value={form.pin_fan} onChange={set('pin_fan')} placeholder="— not fitted —" />
        </FormField>
        <FormField
          label="Strömdetekteringspinn"
          hint="Valfri. BCM GPIO-ingång från optokopplar som känner av elnätet. HÖG = ström OK, LÅG = strömavbrott. Pull-down — öppen krets = strömavbrott (säkert).">
          <Input type="number" value={form.pin_power} onChange={set('pin_power')} placeholder="— inte installerad —" />
        </FormField>
        <FormField label="PWM Frequency (Hz)"
          hint={t('kiln_pwm_hint')}>
          <Input type="number" value={form.pwm_frequency} onChange={set('pwm_frequency')} />
        </FormField>

        {/* ── Sensor ── */}
        <SectionDivider>Thermocouple Sensor</SectionDivider>

        <FormField label="Sensor Board"
          hint={t('kiln_sensor_type_hint')}>
          <Select value={form.sensor_type} onChange={set('sensor_type')}>
            <option value="MAX31856">MAX31856 (recommended)</option>
            <option value="MAX31855">MAX31855 (K-type only)</option>
            <option value="MOCK">Mock — simulated, no hardware</option>
          </Select>
        </FormField>
        <FormField label="Thermocouple Type"
          hint={t('kiln_tc_type_hint')}>
          <Select id="k-tc-type" value={form.tc_type} onChange={set('tc_type')}>
            <option value="K">K — most common, up to ~1350°C</option>
            <option value="S">S — high accuracy, up to 1760°C</option>
            <option value="J">J — up to 760°C</option>
            <option value="N">N — stable at high temps</option>
            <option value="R">R — platinum, high precision</option>
            <option value="T">T — low temperature</option>
            <option value="E">E — high sensitivity</option>
            <option value="B">B — very high temp, up to 1820°C</option>
          </Select>
        </FormField>
        <FormField label="Calibration Offset °C"
          hint={t('kiln_offset_hint')}>
          <Input type="number" step="0.1" value={form.sensor_offset} onChange={set('sensor_offset')} />
        </FormField>
        <FormField label="Watchdog Timeout (s)"
          hint={t('kiln_watchdog_hint')}>
          <Input type="number" value={form.watchdog_timeout_s} onChange={set('watchdog_timeout_s')} />
        </FormField>

        {/* ── Logging ── */}
        <SectionDivider>Logging</SectionDivider>

        <FormField label="Log Level" span={2}
          hint={t('kiln_log_level_hint')}>
          <Select value={form.log_level} onChange={set('log_level')}>
            <option value="OFF">Off — nothing logged to database</option>
            <option value="ERROR">Error — only errors and safety events</option>
            <option value="WARNING">Warning — warnings and errors</option>
            <option value="INFO">Info — normal operation (recommended)</option>
            <option value="DEBUG">Debug — everything including every PID tick</option>
          </Select>
        </FormField>

      </div>
    </Modal>
  )
}

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px 16px',
  },
}
