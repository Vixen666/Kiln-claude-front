import React, { useEffect, useState } from 'react'
import { burnsApi } from '../lib/api'
import { useLang } from '../i18n/index.jsx'
import { Button, EmptyState, PageHeader, Card, Badge } from '../components/UI'
import BurnModal from './BurnModal'

export default function BurnsPage({ toast, onViewBurn }) {
  const { t } = useLang()
  const [burns, setBurns]     = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  async function load() {
    setLoading(true)
    try { setBurns(await burnsApi.list()) }
    catch (e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function handleSave(data) {
    try {
      await burnsApi.create(data)
      toast('Burn created')
      setModalOpen(false)
      load()
    } catch (e) { toast(e.message, 'error') }
  }

  async function handleStart(id, test=false) {
    try { await burnsApi.start(id, test); toast(test ? t('burn_test_data') : t('burn_started')); load() }
    catch (e) { toast(e.message, 'error') }
  }

  async function handleSimulate(id) {
    try { await burnsApi.simulate(id, 60); toast(t('burn_simulated')); load() }
    catch (e) { toast(e.message, 'error') }
  }

  async function handleComplete(id) {
    try { await burnsApi.complete(id); toast(t('burn_completed')); load() }
    catch (e) { toast(e.message, 'error') }
  }

  async function handleAbort(id) {
    if (!confirm(t('confirm_abort'))) return
    try { await burnsApi.abort(id); toast('Burn aborted'); load() }
    catch (e) { toast(e.message, 'error') }
  }

  async function handleDelete(id) {
    if (!confirm(t('confirm_delete_burn'))) return
    try { await burnsApi.delete(id); toast(t('burn_deleted')); load() }
    catch (e) { toast(e.message, 'error') }
  }

  return (
    <div>
      <PageHeader
        title="Burns"
        subtitle="Firing history — each burn links a kiln to a template"
        action={<Button variant="primary" onClick={() => setModalOpen(true)}>+ New Burn</Button>}
      />

      {loading ? (
        <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Loading…</div>
      ) : (
        <div style={styles.grid}>
          {burns.length === 0 ? (
            <EmptyState
              icon="🏺"
              title="No burns yet"
              description="Start a burn by pairing a kiln with a firing template."
              action={<Button variant="primary" onClick={() => setModalOpen(true)}>+ New Burn</Button>}
            />
          ) : burns.map(b => (
            <Card key={b.id} onClick={() => onViewBurn(b.id)}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={styles.cardTitle}>{b.name}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    <Badge status={b.status} />
                  </div>
                </div>
              </div>

              {/* Meta */}
              <div style={styles.metaGrid}>
                <MetaRow label="Kiln"     value={b.kiln.name} />
                <MetaRow label="Template" value={b.template.name} />
                <MetaRow label="Created"  value={fmtDate(b.created_at)} />
                {b.started_at && <MetaRow label="Started" value={fmtDate(b.started_at)} />}
              </div>

              {/* Actions — stop propagation so card click doesn't fire */}
              <div style={styles.actions} onClick={e => e.stopPropagation()}>
                <Button size="sm" variant="ghost" onClick={() => onViewBurn(b.id)}>View</Button>
                {b.status === 'pending' && (<>
                  <Button size="sm" variant="success" onClick={() => handleStart(b.id)}>▶ Start</Button>
                  <Button size="sm" variant="ghost" onClick={() => handleStart(b.id, true)} style={{fontSize:11}}>🧪 Instant</Button>
                  <Button size="sm" variant="ghost" onClick={() => handleSimulate(b.id)} style={{fontSize:11}}>⚡ 60x</Button>
                </>)}
                {b.status === 'running' && <>
                  <Button size="sm" variant="ghost" onClick={() => handleComplete(b.id)}>✓ Complete</Button>
                  <Button size="sm" variant="danger" onClick={() => handleAbort(b.id)}>✕ Abort</Button>
                </>}
                <Button size="sm" variant="danger" onClick={() => handleDelete(b.id)}>Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <BurnModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        toast={toast}
      />
    </div>
  )
}

function MetaRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <span style={{ fontSize: 12, color: 'var(--text-3)', minWidth: 64 }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>{value}</span>
    </div>
  )
}

function fmtDate(s) {
  if (!s) return '–'
  return new Date(s).toLocaleString('sv-SE').replace('T', ' ').slice(0, 16)
}

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: 16,
  },
  cardTitle: { fontSize: 15, fontWeight: 600, color: 'var(--text)' },
  metaGrid: { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 },
  actions: {
    display: 'flex', gap: 6, flexWrap: 'wrap',
    borderTop: '1px solid var(--border)', paddingTop: 12,
  },
}
