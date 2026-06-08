import React, { useEffect, useState } from 'react'
import { elementsApi } from '../lib/api'
import { useLang } from '../i18n/index.jsx'
import { Button, EmptyState, PageHeader } from '../components/UI'
import ElementModal from './ElementModal'

export default function ElementsPage({ toast }) {
  const { t } = useLang()
  const [elements, setElements]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [editing, setEditing]     = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [search, setSearch]       = useState('')
  const [confirmId, setConfirmId] = useState(null)  // inline confirm instead of browser confirm()

  async function load() {
    setLoading(true)
    try { setElements(await elementsApi.list()) }
    catch (e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function handleSave(data) {
    try {
      if (editing?.id) await elementsApi.update(editing.id, data)
      else await elementsApi.create(data)
      toast(t('element_saved'))
      setModalOpen(false)
      load()
    } catch (e) { toast(e.message, 'error') }
  }

  async function handleDelete(id) {
    try {
      await elementsApi.delete(id)
      toast(t('element_deleted'))
      setConfirmId(null)
      load()
    } catch (e) { toast(e.message, 'error') }
  }

  const filtered = elements.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    (e.location || '').toLowerCase().includes(search.toLowerCase()) ||
    (e.supplier || '').toLowerCase().includes(search.toLowerCase())
  )

  const lowStock = elements.filter(e => e.reorder_level > 0 && e.stock_amount <= e.reorder_level)

  return (
    <div>
      <PageHeader
        title={t('elements_title')}
        subtitle={t('elements_subtitle')}
        action={<Button variant="primary" onClick={() => { setEditing(null); setModalOpen(true) }}>{t('elements_new')}</Button>}
      />

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <div style={styles.alert}>
          <span>⚠️</span>
          <span><strong>{lowStock.length}</strong> {t('low_stock_warning')} {lowStock.map(e => e.name).join(', ')}</span>
        </div>
      )}

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          style={styles.search}
          placeholder={t('element_search_ph')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>{t('loading')}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="🧪"
          title={search ? t('no_results') : t('elements_empty_title')}
          description={search ? '' : t('elements_empty_desc')}
          action={!search && <Button variant="primary" onClick={() => { setEditing(null); setModalOpen(true) }}>{t('elements_new')}</Button>}
        />
      ) : (
        /* Scrollable table wrapper */
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>{t('col_name')}</th>
                <th style={styles.th}>{t('col_formula')}</th>
                <th style={styles.th}>{t('col_supplier')}</th>
                <th style={styles.th}>{t('col_location')}</th>
                <th style={styles.th}>{t('col_stock')}</th>
                <th style={styles.th}>{t('col_reorder')}</th>
                <th style={styles.th}>{t('col_notes')}</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(el => {
                const lowStk = el.reorder_level > 0 && el.stock_amount <= el.reorder_level
                const isConfirming = confirmId === el.id
                return (
                  <tr key={el.id} style={{ borderTop: '0.5px solid var(--color-border-tertiary)' }}>
                    <td style={styles.td}>
                      <div style={{ fontWeight: 500, color: 'var(--color-text-primary)', whiteSpace: 'nowrap' }}>{el.name}</div>
                      {el.description && (
                        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 1 }}>{el.description}</div>
                      )}
                    </td>
                    <td style={{ ...styles.td, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                      {el.chemical_formula || '–'}
                    </td>
                    <td style={{ ...styles.td, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{el.supplier || '–'}</td>
                    <td style={{ ...styles.td, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{el.location || '–'}</td>
                    <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>
                      <StockPill amount={el.stock_amount} unit={el.stock_unit} low={lowStk} />
                    </td>
                    <td style={{ ...styles.td, color: 'var(--color-text-secondary)', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {el.reorder_level > 0 ? `${el.reorder_level} ${el.stock_unit}` : '–'}
                    </td>
                    <td style={{ ...styles.td, color: 'var(--color-text-secondary)', fontSize: 12, maxWidth: 180 }}>
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>
                        {el.notes || '–'}
                      </div>
                    </td>
                    <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>
                      {isConfirming ? (
                        /* Inline confirm — works on all browsers including mobile */
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Ta bort?</span>
                          <Button size="sm" variant="danger" onClick={() => handleDelete(el.id)}>Ja</Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>Nej</Button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Button size="sm" onClick={() => { setEditing(el); setModalOpen(true) }}>{t('edit')}</Button>
                          <Button size="sm" variant="danger" onClick={() => setConfirmId(el.id)}>{t('delete')}</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <ElementModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        initial={editing}
      />
    </div>
  )
}

function StockPill({ amount, unit, low }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 99, fontSize: 12, fontWeight: 500,
      background: low ? '#fee2e2' : '#d1fae5',
      color: low ? '#dc2626' : '#059669',
      fontFamily: 'var(--font-mono)',
      whiteSpace: 'nowrap',
    }}>
      {low && <span style={{ fontSize: 10 }}>▼</span>}
      {amount} {unit}
    </span>
  )
}

const styles = {
  alert: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: '#fef3c7', border: '0.5px solid #fcd34d',
    borderRadius: 'var(--border-radius-md)', padding: '10px 14px',
    fontSize: 13, color: '#92400e', marginBottom: 16,
  },
  search: {
    width: '100%', maxWidth: 360,
    background: 'var(--color-background-primary)',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 'var(--border-radius-md)',
    padding: '8px 12px', fontSize: 13,
    color: 'var(--color-text-primary)',
    fontFamily: 'inherit', outline: 'none',
  },
  tableWrap: {
    background: 'var(--color-background-primary)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 'var(--border-radius-lg)',
    overflowX: 'auto',   // horizontal scroll on mobile
    overflowY: 'visible',
    WebkitOverflowScrolling: 'touch',  // smooth momentum scroll on iOS
  },
  table: {
    width: '100%',
    minWidth: 700,        // forces scroll on narrow screens
    borderCollapse: 'collapse',
  },
  th: {
    padding: '10px 14px',
    fontSize: 11, fontWeight: 500, textTransform: 'uppercase',
    letterSpacing: '.8px', color: 'var(--color-text-secondary)',
    background: 'var(--color-background-secondary)',
    textAlign: 'left', whiteSpace: 'nowrap',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    position: 'sticky', top: 0,
  },
  td: {
    padding: '10px 14px',
    fontSize: 13, color: 'var(--color-text-primary)',
    verticalAlign: 'middle',
  },
}
