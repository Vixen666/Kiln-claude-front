import React, { useEffect, useState } from 'react'
import { useLang } from '../i18n/index.jsx'
import Modal from '../components/Modal'
import { Button, FormField, Input, Select, Textarea, SectionDivider } from '../components/UI'
import { elementsApi } from '../lib/api'

const DEFAULTS = {
  name: '', description: '',
  cone: '', color: '', surface: '', firing_type: '', notes: '',
}

export default function RecipeModal({ open, onClose, onSave, initial, toast }) {
  const { t } = useLang()
  const [form, setForm]           = useState(DEFAULTS)
  const [ingredients, setIngredients] = useState([])
  const [elements, setElements]   = useState([])

  useEffect(() => {
    if (!open) return
    setForm({ ...DEFAULTS, ...(initial || {}) })
    setIngredients((initial?.ingredients || []).map(i => ({
      element_id: i.element_id,
      amount: i.amount,
      notes: i.notes || '',
    })))
    elementsApi.list()
      .then(setElements)
      .catch(e => toast(e.message, 'error'))
  }, [open, initial])

  const setF = key => e => setForm(f => ({ ...f, [key]: e.target.value }))

  function addIngredient() {
    if (!elements.length) return
    setIngredients(prev => [...prev, {
      element_id: elements[0].id,
      amount: 10,
      notes: '',
    }])
  }

  function updateIng(i, key, value) {
    setIngredients(prev => prev.map((ing, idx) => idx === i ? { ...ing, [key]: value } : ing))
  }

  function removeIng(i) {
    setIngredients(prev => prev.filter((_, idx) => idx !== i))
  }

  function handleSave() {
    if (!form.name.trim()) return alert(t('name') + ' krävs')
    onSave({
      ...form,
      ingredients: ingredients.map(i => ({
        ...i,
        element_id: +i.element_id,
        amount: +i.amount,
      })),
    })
  }

  const total = ingredients.reduce((s, i) => s + (+i.amount || 0), 0)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial?.id ? t('edit_recipe') : t('new_recipe')}
      width={700}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave}>Save Recipe</Button>
        </>
      }
    >
      <div style={styles.grid}>
        <FormField label="Name *" span={2}>
          <Input value={form.name} onChange={setF('name')} placeholder="Ash Celadon, Shino White…" />
        </FormField>
        <FormField label="Description" span={2}>
          <Input value={form.description} onChange={setF('description')} placeholder="Brief description" />
        </FormField>

        <SectionDivider>Glaze Properties</SectionDivider>

        <FormField label="Cone / Temp">
          <Input value={form.cone} onChange={setF('cone')} placeholder="Cone 6 / 1220°C" />
        </FormField>
        <FormField label="Expected Color">
          <Input value={form.color} onChange={setF('color')} placeholder="Celadon blue, warm white…" />
        </FormField>
        <FormField label="Surface">
          <Select value={form.surface} onChange={setF('surface')}>
            <option value="">— select —</option>
            <option>Matte</option>
            <option>Satin</option>
            <option>Gloss</option>
          </Select>
        </FormField>
        <FormField label="Firing Type">
          <Select value={form.firing_type} onChange={setF('firing_type')}>
            <option value="">— select —</option>
            <option>Oxidation</option>
            <option>Reduction</option>
          </Select>
        </FormField>
        <FormField label="Notes" span={2}>
          <Textarea value={form.notes} onChange={setF('notes')} placeholder="Application method, layering notes, firing tips…" style={{ minHeight: 60 }} />
        </FormField>
      </div>

      <SectionDivider>Ingredients (100g batch basis)</SectionDivider>

      {elements.length === 0 ? (
        <div style={{ color: 'var(--color-text-secondary)', fontSize: 13, padding: '8px 0 12px' }}>
          No elements found. Add raw materials on the Elements page first.
        </div>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {[t('recipe_material'), t('recipe_amount'), t('recipe_pct'), t('notes'), ''].map(h => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ingredients.length === 0 ? (
                  <tr><td colSpan={5} style={styles.emptyCell}>No ingredients yet</td></tr>
                ) : ingredients.map((ing, i) => {
                  const pct = total > 0 ? ((+ing.amount / total) * 100).toFixed(1) : '–'
                  return (
                    <tr key={i} style={{ borderTop: '0.5px solid var(--color-border-tertiary)' }}>
                      <td style={styles.td}>
                        <Select
                          value={ing.element_id}
                          onChange={e => updateIng(i, 'element_id', e.target.value)}
                          style={{ minWidth: 160, fontSize: 12 }}
                        >
                          {elements.map(el => (
                            <option key={el.id} value={el.id}>{el.name}</option>
                          ))}
                        </Select>
                      </td>
                      <td style={styles.td}>
                        <Input
                          type="number" step="0.1" min="0"
                          value={ing.amount}
                          onChange={e => updateIng(i, 'amount', e.target.value)}
                          style={{ width: 80, fontSize: 12 }}
                        />
                      </td>
                      <td style={{ ...styles.td, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-secondary)', minWidth: 50 }}>
                        {pct}%
                      </td>
                      <td style={styles.td}>
                        <Input
                          value={ing.notes}
                          onChange={e => updateIng(i, 'notes', e.target.value)}
                          placeholder="optional"
                          style={{ minWidth: 120, fontSize: 12 }}
                        />
                      </td>
                      <td style={styles.td}>
                        <Button size="sm" variant="danger" onClick={() => removeIng(i)}>✕</Button>
                      </td>
                    </tr>
                  )
                })}
                {ingredients.length > 0 && (
                  <tr style={{ borderTop: '0.5px solid var(--color-border-tertiary)', background: 'var(--color-background-secondary)' }}>
                    <td style={{ ...styles.td, fontWeight: 500 }}>Total</td>
                    <td style={{ ...styles.td, fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{total.toFixed(1)} g</td>
                    <td style={{ ...styles.td, fontFamily: 'var(--font-mono)', fontSize: 12 }}>100%</td>
                    <td colSpan={2} />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 10 }}>
            <Button size="sm" variant="ghost" onClick={addIngredient}>+ Add Ingredient</Button>
          </div>
        </>
      )}
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
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    padding: '6px 8px', fontSize: 10, fontWeight: 500,
    textTransform: 'uppercase', letterSpacing: '.8px',
    color: 'var(--color-text-secondary)',
    background: 'var(--color-background-secondary)',
    textAlign: 'left', borderBottom: '0.5px solid var(--color-border-tertiary)',
    whiteSpace: 'nowrap',
  },
  td: { padding: '5px 6px', verticalAlign: 'middle' },
  emptyCell: {
    padding: '16px 8px', color: 'var(--color-text-secondary)',
    fontSize: 12, textAlign: 'center',
  },
}
