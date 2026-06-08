import React, { useEffect, useState } from 'react'
import { templatesApi } from '../lib/api'
import { useLang } from '../i18n/index.jsx'
import { Button, EmptyState, PageHeader, Card, Badge } from '../components/UI'
import TemplateModal from './TemplateModal'
import RevisionHistory from '../components/RevisionHistory'

export default function TemplatesPage({ toast }) {
  const { t } = useLang()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading]     = useState(true)
  const [editTemplate, setEditTemplate] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [expanded, setExpanded]   = useState(null)  // id of expanded template

  async function load() {
    setLoading(true)
    try { setTemplates(await templatesApi.list()) }
    catch (e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  function openNew()    { setEditTemplate(null); setModalOpen(true) }
  function openEdit(t)  { setEditTemplate(t);    setModalOpen(true) }

  async function openRevision(rev) {
    try {
      const full = await templatesApi.get(rev.id)
      setEditTemplate(full)
      setModalOpen(true)
    } catch (e) { toast(e.message, 'error') }
  }

  async function handleDelete(id) {
    if (!confirm(t('confirm_delete_template'))) return
    try {
      await templatesApi.delete(id)
      toast(t('template_deleted'))
      if (expanded === id) setExpanded(null)
      load()
    } catch (e) { toast(e.message, 'error') }
  }

  async function handleSave(data) {
    try {
      if (editTemplate?.id) await templatesApi.update(editTemplate.id, data)
      else await templatesApi.create(data)
      toast(t('template_saved'))
      setModalOpen(false)
      load()
    } catch (e) { toast(e.message, 'error') }
  }

  function summarize(tmpl) {
    const segs  = tmpl.segments || []
    const peak  = segs.length ? Math.max(...segs.map(s => s.end_temp)) : null
    const total = segs.reduce((a, s) => a + s.duration_minutes + (s.hold_minutes || 0), 0)
    const hrs   = Math.floor(total / 60)
    const mins  = Math.round(total % 60)
    return { peak, hrs, mins, count: segs.length }
  }

  const expandedTemplate = templates.find(t => t.id === expanded)

  return (
    <div>
      <PageHeader
        title={t('templates_title')}
        subtitle={t('templates_subtitle')}
        action={<Button variant="primary" onClick={openNew}>{t('templates_new')}</Button>}
      />

      {loading ? (
        <div style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>{t('loading')}</div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon="📋"
          title={t('template_empty_title')}
          description={t('template_empty_desc')}
          action={<Button variant="primary" onClick={openNew}>{t('templates_new')}</Button>}
        />
      ) : (
        <>
          {/* Expanded view — full width, shown above the grid */}
          {expandedTemplate && (
            <ExpandedCard
              tmpl={expandedTemplate}
              summarize={summarize}
              onEdit={() => openEdit(expandedTemplate)}
              onDelete={() => handleDelete(expandedTemplate.id)}
              onClose={() => setExpanded(null)}
              onSelectRevision={openRevision}
              onDeleteRevision={handleDelete}
              t={t}
            />
          )}

          {/* Grid of cards */}
          <div style={styles.grid}>
            {templates.map(tmpl => {
              const { peak, hrs, mins, count } = summarize(tmpl)
              const isExpanded = tmpl.id === expanded
              return (
                <Card key={tmpl.id} style={isExpanded ? { opacity: 0.5, pointerEvents: 'none' } : {}}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {/* Clickable name */}
                        <button
                          onClick={() => setExpanded(isExpanded ? null : tmpl.id)}
                          style={styles.nameBtn}
                        >
                          {tmpl.name}
                        </button>
                        <span style={styles.revBadge}>r{tmpl.revision ?? 1}</span>
                      </div>
                      {(tmpl.target_material || tmpl.cone) && (
                        <div style={styles.cardSub}>
                          {[tmpl.target_material, tmpl.cone].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <Button size="sm" onClick={() => openEdit(tmpl)}>{t('edit')}</Button>
                      <Button size="sm" variant="danger" onClick={() => handleDelete(tmpl.id)}>{t('delete')}</Button>
                    </div>
                  </div>

                  <MiniCurve segments={tmpl.segments || []} height={48} />

                  <div style={styles.statsRow}>
                    {peak && <Chip label={t('template_peak')} value={`${peak}°C`} />}
                    <Chip label={t('template_duration')} value={hrs ? `${hrs}h ${mins}m` : `${mins}m`} />
                    <Chip label={t('template_segments')} value={count} />
                  </div>


                </Card>
              )
            })}
          </div>
        </>
      )}

      <TemplateModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        initial={editTemplate}
      />
    </div>
  )
}

// ── Expanded full-width card ──────────────────────────────────
function ExpandedCard({ tmpl, summarize, onEdit, onDelete, onClose, onSelectRevision, onDeleteRevision, t }) {
  const { peak, hrs, mins, count } = summarize(tmpl)
  const segs = tmpl.segments || []

  return (
    <div style={styles.expandedCard}>
      {/* Header */}
      <div style={styles.expandedHeader}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={styles.expandedName}>{tmpl.name}</span>
            <span style={styles.revBadge}>r{tmpl.revision ?? 1}</span>
          </div>
          {(tmpl.target_material || tmpl.cone) && (
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 3 }}>
              {[tmpl.target_material, tmpl.cone].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="sm" onClick={onEdit}>{t('edit')}</Button>
          <Button size="sm" variant="danger" onClick={onDelete}>{t('delete')}</Button>
          <Button size="sm" variant="ghost" onClick={onClose}>✕ Stäng</Button>
        </div>
      </div>

      {/* Stats */}
      <div style={styles.expandedStats}>
        {peak && <Chip label={t('template_peak')} value={`${peak}°C`} />}
        <Chip label={t('template_duration')} value={hrs ? `${hrs}h ${mins}m` : `${mins}m`} />
        <Chip label={t('template_segments')} value={count} />
      </div>

      {/* Full-height curve */}
      <MiniCurve segments={segs} height={180} showLabels />

      {/* Segment table */}
      {segs.length > 0 && (
        <div style={{ overflowX: 'auto', marginTop: 16 }}>
          <table style={styles.segTable}>
            <thead>
              <tr>
                {['#', 'Etikett', 'Start °C', 'Slut °C', 'Ramp (min)', 'Håll (min)', 'Notifiera'].map(h => (
                  <th key={h} style={styles.segTh}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...segs].sort((a,b) => a.position - b.position).map((s, i) => (
                <tr key={s.id || i} style={{ borderTop: '0.5px solid var(--color-border-tertiary)' }}>
                  <td style={styles.segTd}>{s.position + 1}</td>
                  <td style={styles.segTd}>{s.label || '—'}</td>
                  <td style={{ ...styles.segTd, fontFamily: 'var(--font-mono)' }}>{s.start_temp}°C</td>
                  <td style={{ ...styles.segTd, fontFamily: 'var(--font-mono)' }}>{s.end_temp}°C</td>
                  <td style={{ ...styles.segTd, fontFamily: 'var(--font-mono)' }}>{s.duration_minutes}</td>
                  <td style={{ ...styles.segTd, fontFamily: 'var(--font-mono)' }}>{s.hold_minutes || 0}</td>
                  <td style={styles.segTd}>{s.notify_on_complete ? '🔔' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Notes */}
      {tmpl.notes && (
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 14, lineHeight: 1.6 }}>
          {tmpl.notes}
        </div>
      )}

      {/* Revision history in expanded view */}
      <div style={{ marginTop: 20, borderTop: '0.5px solid var(--color-border-tertiary)', paddingTop: 16 }}>
        <RevisionHistory
          fetchRevisions={() => templatesApi.revisions(tmpl.id)}
          fetchDiff={(a, b) => templatesApi.diff(a, b)}
          currentId={tmpl.id}
          onSelect={rev => onSelectRevision(rev)}
          onDelete={id => onDeleteRevision(id)}
          label="mall"
        />
      </div>
    </div>
  )
}

// ── Mini/full curve SVG ───────────────────────────────────────
function MiniCurve({ segments, height = 48, showLabels = false }) {
  if (!segments.length) return null
  const W = 600

  const points = []
  let x = 0
  segments.forEach(s => {
    points.push({ x, y: s.start_temp, label: null })
    x += s.duration_minutes
    points.push({ x, y: s.end_temp, label: s.label || null, segEnd: true })
    if (s.hold_minutes > 0) {
      x += s.hold_minutes
      points.push({ x, y: s.end_temp, label: null })
    }
  })

  const xMax = Math.max(...points.map(p => p.x), 1)
  const yMin = Math.min(...points.map(p => p.y))
  const yMax = Math.max(...points.map(p => p.y), 1)
  const PAD = { l: showLabels ? 36 : 4, r: 8, t: showLabels ? 20 : 4, b: showLabels ? 24 : 4 }
  const cw = W - PAD.l - PAD.r
  const ch = height - PAD.t - PAD.b

  const cx = v => PAD.l + (v / xMax) * cw
  const cy = v => PAD.t + ch - ((v - yMin) / Math.max(yMax - yMin, 1)) * ch

  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${cx(p.x).toFixed(1)},${cy(p.y).toFixed(1)}`).join(' ')

  // Filled area
  const fillD = d + ` L${cx(xMax).toFixed(1)},${(PAD.t + ch).toFixed(1)} L${PAD.l},${(PAD.t + ch).toFixed(1)} Z`

  return (
    <div style={{ background: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)', marginBottom: 12, overflow: 'hidden' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="curveGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={fillD} fill="url(#curveGrad)" />
        <path d={d} fill="none" stroke="#1e6fbf" strokeWidth="2" strokeLinejoin="round" />

        {showLabels && points.filter(p => p.segEnd && p.label).map((p, i) => (
          <text key={i} x={cx(p.x)} y={PAD.t - 6}
            fontSize="10" fill="#6b7280" textAnchor="middle">
            {p.label}
          </text>
        ))}
        {showLabels && [0, 0.25, 0.5, 0.75, 1].map(f => {
          const xv = Math.round(f * xMax)
          return (
            <text key={f} x={cx(xv)} y={height - 6}
              fontSize="9" fill="#9ca3af" textAnchor="middle">
              {xv}min
            </text>
          )
        })}
        {showLabels && [0, 0.5, 1].map(f => {
          const yv = Math.round(yMin + f * (yMax - yMin))
          return (
            <text key={f} x={PAD.l - 4} y={cy(yv) + 4}
              fontSize="9" fill="#9ca3af" textAnchor="end">
              {yv}°
            </text>
          )
        })}
      </svg>
    </div>
  )
}

function Chip({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <span style={{ fontSize: 10, color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.8px' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>{value}</span>
    </div>
  )
}

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: 16,
  },
  nameBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)',
    fontFamily: 'var(--font)', padding: 0, textAlign: 'left',
    textDecoration: 'underline', textDecorationStyle: 'dotted',
    textUnderlineOffset: 3,
  },
  cardSub: { fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 },
  statsRow: {
    display: 'flex', justifyContent: 'space-around',
    background: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)',
    padding: '10px 8px', marginTop: 6, marginBottom: 10,
  },
  revBadge: {
    fontSize: 10, fontWeight: 700, padding: '2px 6px',
    borderRadius: 4, background: '#e0f2fe', color: '#0369a1',
    fontFamily: 'var(--font-mono)', flexShrink: 0,
  },

  // Expanded card
  expandedCard: {
    background: 'var(--color-background-primary)',
    border: '1.5px solid #60a5fa',
    borderRadius: 'var(--border-radius-lg)',
    padding: '20px 24px',
    marginBottom: 24,
    boxShadow: '0 4px 24px rgba(30,111,191,.12)',
  },
  expandedHeader: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10,
  },
  expandedName: {
    fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)',
  },
  expandedStats: {
    display: 'flex', gap: 32,
    marginBottom: 16,
  },
  segTable: {
    width: '100%', borderCollapse: 'collapse', fontSize: 13,
  },
  segTh: {
    padding: '8px 12px', textAlign: 'left',
    fontSize: 11, fontWeight: 500, textTransform: 'uppercase',
    letterSpacing: '.6px', color: 'var(--color-text-secondary)',
    background: 'var(--color-background-secondary)',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    whiteSpace: 'nowrap',
  },
  segTd: {
    padding: '9px 12px', color: 'var(--color-text-primary)',
    verticalAlign: 'middle',
  },
}
