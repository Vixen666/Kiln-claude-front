import React, { useEffect, useState } from 'react'
import { Button } from './UI'

/**
 * RevisionHistory
 * Props:
 *   fetchRevisions  — async () => [{id, revision, name, created_at, in_use, cone, ...}]
 *   fetchDiff       — async (fromId, toId) => {changes:[...]}
 *   currentId       — currently active revision id
 *   onSelect        — (revision) => void
 *   onDelete        — (id) => void
 */
export default function RevisionHistory({ fetchRevisions, fetchDiff, currentId, onSelect, onDelete }) {
  const [open, setOpen]           = useState(false)
  const [loading, setLoading]     = useState(false)
  const [revisions, setRevisions] = useState([])
  const [expanded, setExpanded]     = useState(null)
  const [diffs, setDiffs]           = useState({})    // { revId: diffResult }
  const [diffLoading, setDiffLoading] = useState(null) // revId being loaded

  async function load() {
    setLoading(true)
    try { setRevisions(await fetchRevisions()) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (open) load() }, [open])

  async function handleExpand(rev) {
    if (expanded === rev.id) { setExpanded(null); return }
    setExpanded(rev.id)

    // Find the previous (older) revision to diff against
    const idx = revisions.findIndex(r => r.id === rev.id)
    const olderRev = revisions[idx + 1]  // revisions are newest-first, so +1 is older

    if (olderRev && fetchDiff && !diffs[rev.id]) {
      setDiffLoading(rev.id)
      try {
        const result = await fetchDiff(olderRev.id, rev.id)
        setDiffs(prev => ({ ...prev, [rev.id]: result }))
      } catch (e) { console.error(e) }
      finally { setDiffLoading(null) }
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={styles.toggleBtn}>
        Visa revisioner ▾
      </button>
    )
  }

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span style={styles.title}>Revisionshistorik</span>
        <button onClick={() => { setOpen(false); setExpanded(null); setDiff(null) }} style={styles.closeBtn}>✕</button>
      </div>

      {loading ? (
        <div style={styles.empty}>Laddar…</div>
      ) : revisions.length === 0 ? (
        <div style={styles.empty}>Inga revisioner hittades.</div>
      ) : (
        <div>
          {revisions.map((r, idx) => {
            const isCurrent  = r.id === currentId
            const isExpanded = expanded === r.id
            const isNewest   = idx === 0
            // The revision this one was changed into (newer)
            const olderRev   = revisions[idx + 1]  // older = next in newest-first list

            return (
              <div key={r.id}>
                {/* Row */}
                <div
                  onClick={() => handleExpand(r)}
                  style={{
                    ...styles.row,
                    background: isCurrent ? '#eff6ff' : isExpanded ? '#f8faff' : 'var(--color-background-primary)',
                    cursor: 'pointer',
                  }}
                >
                  {/* Left — revision info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                      <span style={styles.revBadge}>r{r.revision}</span>
                      <span style={{ fontSize: 13, fontWeight: isCurrent ? 600 : 400, color: 'var(--color-text-primary)' }}>
                        {r.name}
                      </span>
                      {isCurrent  && <span style={styles.badgeCurrent}>Aktuell</span>}
                      {isNewest && !isCurrent && <span style={styles.badgeLatest}>Senaste</span>}
                      {r.in_use   && <span style={styles.badgeInUse}>Används</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 3 }}>
                      {r.cone && <span style={{ marginRight: 8 }}>{r.cone}</span>}
                      {fmtDate(r.created_at)}
                      {olderRev && !isExpanded && (
                        <span style={{ marginLeft: 8, color: '#6b7280' }}>
                          ← ändrad från r{olderRev.revision}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right — actions */}
                  <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}
                    onClick={e => e.stopPropagation()}>
                    {!isCurrent && (
                      <Button size="sm" variant="ghost" onClick={() => onSelect(r)}>
                        Använd
                      </Button>
                    )}
                    {!r.in_use && (
                      <Button size="sm" variant="danger" onClick={() => {
                        if (window.confirm(`Ta bort revision ${r.revision} av "${r.name}"?`)) {
                          onDelete(r.id); load()
                        }
                      }}>
                        Ta bort
                      </Button>
                    )}
                    <span style={{ fontSize: 14, color: 'var(--color-text-secondary)', padding: '0 4px' }}>
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  </div>
                </div>

                {/* Expanded panel — full width diff */}
                {isExpanded && (
                  <div style={styles.expandedPanel}>
                    {diffLoading === r.id ? (
                      <div style={styles.diffEmpty}>Laddar ändringar…</div>
                    ) : !olderRev ? (
                      <div style={styles.diffEmpty}>
                        Detta är den ursprungliga versionen — inga tidigare ändringar att visa.
                      </div>
                    ) : !diffs[r.id] || diffs[r.id].changes.length === 0 ? (
                      <div style={styles.diffEmpty}>
                        Inga ändringar hittades jämfört med föregående revision.
                      </div>
                    ) : (
                      <div>
                        <div style={styles.diffHeader}>
                          Ändringar i denna revision (r{r.revision})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {diffs[r.id].changes.map((ch, i) => (
                            <DiffRow key={i} change={ch} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DiffRow({ change }) {
  if (change.type === 'field') {
    return (
      <div style={styles.diffRow}>
        <span style={styles.diffField}>{change.field}</span>
        <span style={styles.diffFrom}>{change.from || '—'}</span>
        <span style={styles.diffArrow}>→</span>
        <span style={styles.diffTo}>{change.to || '—'}</span>
      </div>
    )
  }

  if (change.type === 'ingredient') {
    const color = change.change === 'added' ? '#059669' :
                  change.change === 'removed' ? '#dc2626' : '#d97706'
    const icon  = change.change === 'added' ? '＋' :
                  change.change === 'removed' ? '－' : '△'
    return (
      <div style={{ ...styles.diffRow, borderLeftColor: color }}>
        <span style={{ ...styles.diffField, color }}>{icon} {change.name}</span>
        {change.change === 'changed' && (
          <>
            <span style={styles.diffFrom}>{change.from}g</span>
            <span style={styles.diffArrow}>→</span>
            <span style={styles.diffTo}>{change.to}g</span>
            <span style={{
              fontSize: 11, marginLeft: 4, fontWeight: 600,
              color: change.diff > 0 ? '#059669' : '#dc2626'
            }}>
              ({change.diff > 0 ? '+' : ''}{change.diff}g)
            </span>
          </>
        )}
        {change.change === 'added'   && <span style={{ ...styles.diffTo, color }}>+{change.to}g</span>}
        {change.change === 'removed' && <span style={{ ...styles.diffFrom, color, textDecoration: 'line-through' }}>{change.from}g</span>}
      </div>
    )
  }

  if (change.type === 'segment') {
    const color = change.change === 'added' ? '#059669' :
                  change.change === 'removed' ? '#dc2626' : '#d97706'
    const icon  = change.change === 'added' ? '＋' :
                  change.change === 'removed' ? '－' : '△'
    return (
      <div style={{ ...styles.diffRow, borderLeftColor: color }}>
        <span style={{ ...styles.diffField, color }}>{icon} {change.label}</span>
        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{change.detail}</span>
      </div>
    )
  }

  return null
}

function fmtDate(s) {
  if (!s) return ''
  return new Date(s).toLocaleDateString('sv-SE')
}

const styles = {
  toggleBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 12, color: 'var(--color-text-secondary)',
    fontFamily: 'var(--font)', padding: '4px 0',
    textDecoration: 'underline',
  },
  panel: {
    marginTop: 10,
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 'var(--border-radius-md)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 14px',
    background: 'var(--color-background-secondary)',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  title: {
    fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '.8px', color: 'var(--color-text-secondary)',
  },
  closeBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--color-text-secondary)', fontSize: 14,
    padding: 0, fontFamily: 'var(--font)',
  },
  row: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 14px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    transition: 'background .1s',
  },
  revBadge: {
    fontSize: 10, fontWeight: 700, padding: '2px 6px',
    borderRadius: 4, background: '#e0f2fe', color: '#0369a1',
    fontFamily: 'var(--font-mono)', flexShrink: 0,
  },
  badgeCurrent: {
    fontSize: 10, padding: '2px 7px', borderRadius: 99,
    background: '#dbeafe', color: '#1e40af', fontWeight: 500,
  },
  badgeLatest: {
    fontSize: 10, padding: '2px 7px', borderRadius: 99,
    background: '#f0fdf4', color: '#166534', fontWeight: 500,
  },
  badgeInUse: {
    fontSize: 10, padding: '2px 7px', borderRadius: 99,
    background: '#d1fae5', color: '#065f46', fontWeight: 500,
  },
  expandedPanel: {
    padding: '14px 16px',
    background: '#f8faff',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    borderLeft: '3px solid #60a5fa',
  },
  diffHeader: {
    fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '.5px', color: '#4b6cb7',
    marginBottom: 10,
  },
  diffEmpty: {
    fontSize: 12, color: 'var(--color-text-secondary)', fontStyle: 'italic',
  },
  diffRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '5px 10px',
    background: '#fff',
    borderRadius: 6,
    borderLeft: '3px solid #d97706',
    fontSize: 12,
  },
  diffField: {
    fontWeight: 500, color: 'var(--color-text-primary)',
    minWidth: 120, flexShrink: 0,
  },
  diffFrom: {
    color: '#dc2626', fontFamily: 'var(--font-mono)',
    textDecoration: 'line-through',
  },
  diffArrow: { color: '#9ca3af' },
  diffTo: {
    color: '#059669', fontFamily: 'var(--font-mono)', fontWeight: 600,
  },
}
