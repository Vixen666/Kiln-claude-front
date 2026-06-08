import React, { useEffect, useState } from 'react'
import { kilnsApi } from '../lib/api'
import { useLang } from '../i18n/index.jsx'
import { Button, EmptyState, PageHeader, Card } from '../components/UI'
import KilnModal from './KilnModal'

export default function KilnsPage({ toast }) {
  const { t } = useLang()
  const [kilns, setKilns]     = useState([])
  const [loading, setLoading] = useState(true)
  const [editKiln, setEditKiln] = useState(null)   // null = closed, {} = new, kiln obj = edit
  const [modalOpen, setModalOpen] = useState(false)

  async function load() {
    setLoading(true)
    try { setKilns(await kilnsApi.list()) }
    catch (e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  function openNew()   { setEditKiln(null); setModalOpen(true) }
  function openEdit(k) { setEditKiln(k);    setModalOpen(true) }

  async function handleDelete(id) {
    if (!confirm(t('confirm_delete_kiln'))) return
    try {
      await kilnsApi.delete(id)
      toast(t('kiln_deleted'))
      load()
    } catch (e) { toast(e.message, 'error') }
  }

  async function handleSave(data) {
    try {
      if (editKiln?.id) await kilnsApi.update(editKiln.id, data)
      else await kilnsApi.create(data)
      toast(t('kiln_saved'))
      setModalOpen(false)
      load()
    } catch (e) { toast(e.message, 'error') }
  }

  return (
    <div>
      <PageHeader
        title="Kilns"
        subtitle="Manage your kilns and their hardware configuration"
        action={<Button variant="primary" onClick={openNew}>+ New Kiln</Button>}
      />

      {loading ? (
        <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Loading…</div>
      ) : (
        <div style={styles.grid}>
          {kilns.length === 0 ? (
            <EmptyState
              icon="🔥"
              title="No kilns yet"
              description="Add your first kiln to configure its hardware settings and PID parameters."
              action={<Button variant="primary" onClick={openNew}>+ New Kiln</Button>}
            />
          ) : kilns.map(k => (
            <Card key={k.id}>
              {/* Header row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div>
                  <div style={styles.cardTitle}>{k.name}</div>
                  {k.description && <div style={styles.cardSub}>{k.description}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button size="sm" onClick={() => openEdit(k)}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => handleDelete(k.id)}>Delete</Button>
                </div>
              </div>

              {/* Stats */}
              <div style={styles.statsRow}>
                <Stat label="Kp" value={k.pid_kp} />
                <Stat label="Ki" value={k.pid_ki} />
                <Stat label="Kd" value={k.pid_kd} />
              </div>

              <div style={styles.divider} />

              <div style={styles.metaRow}>
                <MetaItem icon="🌡" label={`${k.temp_min}–${k.temp_max}°C`} />
                <MetaItem icon="📍" label={`GPIO ${k.pin_heater} heater · ${k.pin_sensor} sensor`} />
                <MetaItem icon="🔌" label={k.sensor_type} />
              </div>
            </Card>
          ))}
        </div>
      )}

      <KilnModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        initial={editKiln}
      />
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.8px' }}>{label}</span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 500, color: 'var(--accent)' }}>{value}</span>
    </div>
  )
}

function MetaItem({ icon, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-2)' }}>
      <span>{icon}</span><span>{label}</span>
    </div>
  )
}

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: 16,
  },
  cardTitle: { fontSize: 15, fontWeight: 600, color: 'var(--text)', letterSpacing: '-.1px' },
  cardSub:   { fontSize: 12, color: 'var(--text-3)', marginTop: 2 },
  statsRow: {
    display: 'flex', justifyContent: 'space-around',
    background: 'var(--accent-subtle)', borderRadius: 'var(--r)',
    padding: '10px 8px', marginBottom: 14,
  },
  divider: { height: 1, background: 'var(--border)', marginBottom: 12 },
  metaRow: { display: 'flex', flexDirection: 'column', gap: 6 },
}
