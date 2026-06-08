import React, { useEffect, useState } from 'react'
import Modal from '../components/Modal'
import { Button, FormField, Input, Select, Textarea } from '../components/UI'
import { burnsApi, recipesApi } from '../lib/api'
import { useLang } from '../i18n/index.jsx'

const STATUSES = [
  { value: 'studio',     label: 'I studio',        color: '#6b7280' },
  { value: 'for_sale',   label: 'Till salu',        color: '#059669' },
  { value: 'sold',       label: 'Såld',             color: '#dc2626' },
  { value: 'gifted',     label: 'Bortgiven',        color: '#7c3aed' },
  { value: 'exhibition', label: 'På utställning',   color: '#d97706' },
]

const DEFAULTS = {
  name: '', description: '', status: 'studio',
  price: '', dimensions: '', weight_g: '',
  tags: '', notes: '', published: false,
  burn_id: '', recipe_id: '',
}

export default function ItemModal({ open, onClose, onSave, initial }) {
  const { t } = useLang()
  const [form, setForm]       = useState(DEFAULTS)
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags]       = useState([])
  const [burns, setBurns]     = useState([])
  const [recipes, setRecipes] = useState([])

  useEffect(() => {
    if (open) {
      const init = initial || {}
      setForm({ ...DEFAULTS, ...init, price: init.price ?? '', weight_g: init.weight_g ?? '' })
      setTags(init.tags ? init.tags.split(',').filter(Boolean) : [])
      setTagInput('')
    }
  }, [open, initial])

  useEffect(() => {
    if (!open) return
    Promise.all([burnsApi.list(), recipesApi.list()])
      .then(([b, r]) => { setBurns(b); setRecipes(r) })
      .catch(() => {})
  }, [open])

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }))

  function addTag(t) {
    const clean = t.trim().toLowerCase()
    if (clean && !tags.includes(clean)) setTags(prev => [...prev, clean])
    setTagInput('')
  }

  function handleSave() {
    if (!form.name.trim()) return alert('Namn krävs')
    onSave({
      ...form,
      tags:      tags.join(','),
      price:     form.price     !== '' ? +form.price     : null,
      weight_g:  form.weight_g  !== '' ? +form.weight_g  : null,
      burn_id:   form.burn_id   !== '' ? +form.burn_id   : null,
      recipe_id: form.recipe_id !== '' ? +form.recipe_id : null,
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial?.id ? 'Redigera objekt' : 'Nytt objekt'}
      width={600}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
          <Button variant="primary" onClick={handleSave}>Spara objekt</Button>
        </>
      }
    >
      <div style={styles.grid}>

        <FormField label="Namn *" span={2}>
          <Input value={form.name} onChange={set('name')} placeholder="Blå mugg #3, Skål Askceladon…" />
        </FormField>

        <FormField label="Beskrivning" span={2}>
          <Textarea value={form.description} onChange={set('description')}
            placeholder="Kort beskrivning av objektet…" style={{ minHeight: 60 }} />
        </FormField>

        <FormField label="Status">
          <Select value={form.status} onChange={set('status')}>
            {STATUSES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </Select>
        </FormField>

        <FormField label="Pris (kr)" hint="Lämna tomt om ej till salu">
          <Input type="number" min="0" step="10" value={form.price} onChange={set('price')} placeholder="–" />
        </FormField>

        <FormField label="Mått" hint="T.ex. H: 12cm, Ø: 8cm">
          <Input value={form.dimensions} onChange={set('dimensions')} placeholder="H: 12cm, Ø: 8cm" />
        </FormField>

        <FormField label="Vikt (g)">
          <Input type="number" min="0" value={form.weight_g} onChange={set('weight_g')} placeholder="–" />
        </FormField>

        <FormField label="Bränning" hint="Vilken bränning skapades detta i?">
          <Select value={form.burn_id} onChange={set('burn_id')}>
            <option value="">— ingen koppling —</option>
            {burns.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </Select>
        </FormField>

        <FormField label="Glasyrrecept">
          <Select value={form.recipe_id} onChange={set('recipe_id')}>
            <option value="">— ingen koppling —</option>
            {recipes.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </Select>
        </FormField>

        {/* Tags */}
        <FormField label="Taggar" span={2} hint="Enter eller komma för att lägga till">
          {tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
              {tags.map(tg => (
                <span key={tg} style={styles.tagChip}>
                  {tg}
                  <button onClick={() => setTags(prev => prev.filter(x => x !== tg))}
                    style={styles.tagRemove}>×</button>
                </span>
              ))}
            </div>
          )}
          <Input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput) }
              if (e.key === 'Backspace' && !tagInput && tags.length) setTags(prev => prev.slice(0,-1))
            }}
            placeholder="mugg, blå, stengods, 2024…"
          />
        </FormField>

        <FormField label="Anteckningar" span={2}>
          <Textarea value={form.notes} onChange={set('notes')}
            placeholder="Glasyrens beteende, sprickor, specialteknik…" style={{ minHeight: 60 }} />
        </FormField>

        {/* Published toggle */}
        <FormField label="Publicera i showroom" span={2}
          hint="Synkroniseras till den publika webbsidan när publicering är aktiverad">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, published: !f.published }))}
              style={{
                width: 44, height: 24, borderRadius: 99, border: 'none',
                background: form.published ? '#059669' : '#d1d5db',
                cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0,
              }}
            >
              <span style={{
                position: 'absolute', top: 3,
                left: form.published ? 23 : 3,
                width: 18, height: 18, borderRadius: '50%',
                background: '#fff', transition: 'left .2s',
                boxShadow: '0 1px 3px rgba(0,0,0,.2)',
              }} />
            </button>
            <span style={{ fontSize: 13, color: form.published ? '#059669' : 'var(--color-text-secondary)' }}>
              {form.published ? '✓ Publiceras i showroom' : 'Ej publicerad'}
            </span>
          </div>
        </FormField>

      </div>
    </Modal>
  )
}

const styles = {
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' },
  tagChip: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '3px 8px', borderRadius: 99, fontSize: 12, fontWeight: 500,
    background: '#dbeafe', color: '#1e40af',
  },
  tagRemove: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#1e40af', fontSize: 14, lineHeight: 1, padding: 0,
  },
}
