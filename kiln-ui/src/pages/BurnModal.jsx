import React, { useEffect, useState } from 'react'
import { useLang } from '../i18n/index.jsx'
import Modal from '../components/Modal'
import { Button, FormField, Input, Select, Textarea } from '../components/UI'
import { kilnsApi, templatesApi } from '../lib/api'

export default function BurnModal({ open, onClose, onSave, toast }) {
  const { t } = useLang()
  const [form, setForm]           = useState({ name: '', kiln_id: '', template_id: '', notes: '', resume_on_power_loss: false, resume_timeout_minutes: 30 })
  const [kilns, setKilns]         = useState([])
  const [templates, setTemplates] = useState([])

  useEffect(() => {
    if (!open) return
    setForm({ name: '', kiln_id: '', template_id: '', notes: '', resume_on_power_loss: false, resume_timeout_minutes: 30 })
    Promise.all([kilnsApi.list(), templatesApi.list()])
      .then(([k, t]) => { setKilns(k); setTemplates(t) })
      .catch(e => toast(e.message, 'error'))
  }, [open])

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }))

  async function handleSave() {
    if (!form.name.trim() || !form.kiln_id || !form.template_id)
      return alert(t('name') + ', ugn och mall krävs')
    onSave({ ...form, kiln_id: +form.kiln_id, template_id: +form.template_id, resume_timeout_minutes: +form.resume_timeout_minutes })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Burn"
      width={500}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave}>Create Burn</Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FormField label="Burn Name *">
          <Input value={form.name} onChange={set('name')} placeholder="Batch #12 – June" />
        </FormField>

        <FormField label="Kiln *">
          <Select value={form.kiln_id} onChange={set('kiln_id')}>
            <option value="">— select a kiln —</option>
            {kilns.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
          </Select>
        </FormField>

        <FormField label="Template *">
          <Select value={form.template_id} onChange={set('template_id')}>
            <option value="">— select a template —</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </FormField>

        <FormField label="Notes">
          <Textarea value={form.notes} onChange={set('notes')} placeholder="Load description, glaze combos…" style={{ minHeight: 64 }} />
        </FormField>

        {/* Power loss recovery */}
        <FormField
          label="Återuppta vid strömavbrott"
          hint="Om strömmen försvinner och återkommer inom tidsgränsen fortsätter bränningen automatiskt."
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, resume_on_power_loss: !f.resume_on_power_loss }))}
              style={{
                width: 44, height: 24, borderRadius: 99, border: 'none',
                background: form.resume_on_power_loss ? '#1e6fbf' : '#d1d5db',
                cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0,
              }}
            >
              <span style={{
                position: 'absolute', top: 3,
                left: form.resume_on_power_loss ? 23 : 3,
                width: 18, height: 18, borderRadius: '50%',
                background: '#fff', transition: 'left .2s',
                boxShadow: '0 1px 3px rgba(0,0,0,.2)',
              }} />
            </button>
            <span style={{ fontSize: 13, color: form.resume_on_power_loss ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
              {form.resume_on_power_loss ? 'Aktiverat' : 'Inaktiverat'}
            </span>
          </div>
        </FormField>

        {form.resume_on_power_loss && (
          <FormField
            label="Tidsgräns (minuter)"
            hint="Avbryt om strömmen var borta längre än detta. Typiskt 10–30 min för välbyggda ugnar."
          >
            <Input
              type="number" min="1" max="120"
              value={form.resume_timeout_minutes}
              onChange={set('resume_timeout_minutes')}
            />
          </FormField>
        )}
      </div>
    </Modal>
  )
}
