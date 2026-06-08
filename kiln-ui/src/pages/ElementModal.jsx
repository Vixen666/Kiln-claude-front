import React, { useEffect, useState } from 'react'
import { useLang } from '../i18n/index.jsx'
import Modal from '../components/Modal'
import { Button, FormField, Input, Select, Textarea, SectionDivider } from '../components/UI'

const DEFAULTS = {
  name: '', description: '',
  chemical_formula: '', supplier: '', location: '',
  stock_amount: 0, stock_unit: 'g', reorder_level: 0,
  notes: '',
}

export default function ElementModal({ open, onClose, onSave, initial }) {
  const { t } = useLang()
  const [form, setForm] = useState(DEFAULTS)

  useEffect(() => {
    if (open) setForm({ ...DEFAULTS, ...(initial || {}) })
  }, [open, initial])

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }))

  function handleSave() {
    if (!form.name.trim()) return alert(t('name') + ' krävs')
    onSave({
      ...form,
      stock_amount:  +form.stock_amount,
      reorder_level: +form.reorder_level,
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial?.id ? t('edit_element') : t('new_element')}
      width={580}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave}>Save Element</Button>
        </>
      }
    >
      <div style={styles.grid}>
        <FormField label="Name *" span={2}>
          <Input value={form.name} onChange={set('name')} placeholder="Silica, Feldspar, Kaolin…" />
        </FormField>
        <FormField label="Description" span={2}>
          <Input value={form.description} onChange={set('description')} placeholder="Brief description" />
        </FormField>

        <SectionDivider>Material Info</SectionDivider>

        <FormField label="Chemical Formula" hint="e.g. SiO₂, Al₂O₃·2SiO₂·2H₂O">
          <Input value={form.chemical_formula} onChange={set('chemical_formula')} placeholder="SiO₂" />
        </FormField>
        <FormField label="Supplier">
          <Input value={form.supplier} onChange={set('supplier')} placeholder="Supplier name" />
        </FormField>
        <FormField label="Storage Location" hint="Shelf, bin, or room" span={2}>
          <Input value={form.location} onChange={set('location')} placeholder="Shelf A3, Bin 7…" />
        </FormField>

        <SectionDivider>Stock</SectionDivider>

        <FormField label="Current Stock">
          <Input type="number" step="0.1" min="0" value={form.stock_amount} onChange={set('stock_amount')} />
        </FormField>
        <FormField label="Unit">
          <Select value={form.stock_unit} onChange={set('stock_unit')}>
            <option value="g">g — grams</option>
            <option value="kg">kg — kilograms</option>
            <option value="lb">lb — pounds</option>
          </Select>
        </FormField>
        <FormField label="Reorder Level" hint="Alert when stock drops to this" span={2}>
          <Input type="number" step="0.1" min="0" value={form.reorder_level} onChange={set('reorder_level')} />
        </FormField>

        <SectionDivider>Notes</SectionDivider>

        <FormField label="Notes" span={2}>
          <Textarea value={form.notes} onChange={set('notes')} placeholder="Firing behaviour, handling notes, mesh size…" style={{ minHeight: 72 }} />
        </FormField>
      </div>
    </Modal>
  )
}

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px 16px',
  },
}
