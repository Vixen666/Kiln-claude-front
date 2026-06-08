import React, { useEffect, useRef, useState } from 'react'
import { useLang } from '../i18n/index.jsx'
import { systemLogsApi } from '../lib/api'
import { Button, Card } from './UI'

const LEVELS = ['ALL', 'DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']

const LEVEL_STYLE = {
  DEBUG:    { bg: '#f3f4f6', color: '#6b7280', dot: '#9ca3af' },
  INFO:     { bg: '#eff6ff', color: '#1e40af', dot: '#3b82f6' },
  WARNING:  { bg: '#fffbeb', color: '#92400e', dot: '#f59e0b' },
  ERROR:    { bg: '#fef2f2', color: '#991b1b', dot: '#ef4444' },
  CRITICAL: { bg: '#fdf2f8', color: '#831843', dot: '#ec4899' },
}

/**
 * SystemLogPanel
 * Props:
 *   burnId    — filter to a specific burn (optional)
 *   running   — if true, polls for new entries every 5s
 *   maxHeight — scroll area height (default 360px)
 */
export default function SystemLogPanel({ burnId, running = false, maxHeight = 360 }) {
  const { t } = useLang()
  const [logs, setLogs]         = useState([])
  const [filter, setFilter]     = useState('ALL')
  const [loading, setLoading]   = useState(true)
  const [paused, setPaused]     = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const lastIdRef  = useRef(0)
  const scrollRef  = useRef(null)
  const pollRef    = useRef(null)

  async function load() {
    setLoading(true)
    try {
      const params = { limit: 200 }
      if (burnId) params.burn_id = burnId
      if (filter !== 'ALL') params.level = filter
      const rows = await systemLogsApi.list(params)
      // API returns newest-first; reverse for chronological display
      const sorted = [...rows].reverse()
      setLogs(sorted)
      if (sorted.length) lastIdRef.current = sorted[sorted.length - 1].id
    } finally {
      setLoading(false)
    }
  }

  async function poll() {
    if (paused) return
    try {
      const params = { after_id: lastIdRef.current, limit: 100 }
      if (burnId) params.burn_id = burnId
      if (filter !== 'ALL') params.level = filter
      const newRows = await systemLogsApi.list(params)
      if (!newRows.length) return
      // newRows is newest-first; reverse to get chronological
      const sorted = [...newRows].reverse()
      setLogs(prev => [...prev, ...sorted].slice(-500))  // keep last 500
      lastIdRef.current = sorted[sorted.length - 1].id
    } catch { /* silent */ }
  }

  // Initial load + re-load when filter changes
  useEffect(() => {
    lastIdRef.current = 0
    load()
  }, [burnId, filter])

  // Polling
  useEffect(() => {
    if (!running) return
    pollRef.current = setInterval(poll, 5000)
    return () => clearInterval(pollRef.current)
  }, [running, paused, burnId, filter])

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  async function handleClear() {
    if (!confirm(t('confirm_clear_logs') + (burnId ? ' for this burn' : '') + '?')) return
    await systemLogsApi.clear(burnId)
    setLogs([])
    lastIdRef.current = 0
  }

  return (
    <Card style={{ marginBottom: 20 }}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.sectionLabel}>System Log</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Level filter */}
          <div style={styles.levelFilter}>
            {LEVELS.map(l => (
              <button
                key={l}
                onClick={() => setFilter(l)}
                style={{
                  ...styles.levelBtn,
                  ...(filter === l ? styles.levelBtnActive : {}),
                  ...(l !== 'ALL' && filter !== l ? {
                    color: LEVEL_STYLE[l]?.color || '#374151',
                  } : {}),
                }}
              >
                {l}
              </button>
            ))}
          </div>

          {running && (
            <button
              onClick={() => setPaused(p => !p)}
              style={styles.iconBtn}
              title={paused ? 'Resume live updates' : 'Pause live updates'}
            >
              {paused ? '▶' : '⏸'}
            </button>
          )}
          <button
            onClick={() => setAutoScroll(a => !a)}
            style={{ ...styles.iconBtn, background: autoScroll ? '#dbeafe' : undefined }}
            title={autoScroll ? 'Auto-scroll on' : 'Auto-scroll off'}
          >
            ↓
          </button>
          <button onClick={load} style={styles.iconBtn} title="Refresh">↺</button>
          <button onClick={handleClear} style={{ ...styles.iconBtn, color: '#dc2626' }}
            title="Clear logs">🗑</button>
        </div>
      </div>

      {/* Status bar */}
      {running && (
        <div style={styles.statusBar}>
          <span style={{ color: paused ? '#d97706' : '#059669', fontWeight: 500 }}>
            {paused ? t('syslog_paused') : t('syslog_live')}
          </span>
          <span style={{ marginLeft: 8, color: 'var(--color-text-secondary)' }}>
            {logs.length} entries
          </span>
        </div>
      )}

      {/* Log entries */}
      <div
        ref={scrollRef}
        style={{ ...styles.logWrap, maxHeight }}
        onScroll={e => {
          const el = e.currentTarget
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
          setAutoScroll(atBottom)
        }}
      >
        {loading ? (
          <div style={styles.empty}>Loading…</div>
        ) : logs.length === 0 ? (
          <div style={styles.empty}>No log entries yet.</div>
        ) : (
          logs.map(entry => <LogEntry key={entry.id} entry={entry} />)
        )}
      </div>
    </Card>
  )
}

function LogEntry({ entry }) {
  const s = LEVEL_STYLE[entry.level] || LEVEL_STYLE.INFO
  return (
    <div style={{ ...styles.entry, background: s.bg }}>
      <span style={{ ...styles.dot, background: s.dot }} />
      <span style={styles.ts}>{fmtTime(entry.created_at)}</span>
      <span style={{ ...styles.level, color: s.color }}>{entry.level}</span>
      <span style={styles.loggerName}>{shortLogger(entry.logger)}</span>
      <span style={{ ...styles.message, color: s.color }}>{entry.message}</span>
    </div>
  )
}

function fmtTime(s) {
  if (!s) return ''
  return new Date(s).toLocaleTimeString('sv-SE', { hour12: false })
}

function shortLogger(name) {
  if (!name) return ''
  // "app.pid.controller" → "controller"
  return name.split('.').pop()
}

const styles = {
  header: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8,
  },
  sectionLabel: {
    fontSize: 11, fontWeight: 500, textTransform: 'uppercase',
    letterSpacing: '1px', color: 'var(--color-text-secondary)',
  },
  levelFilter: {
    display: 'flex', gap: 2,
    background: 'var(--color-background-secondary)',
    borderRadius: 'var(--border-radius-md)',
    padding: 2,
  },
  levelBtn: {
    padding: '3px 8px', borderRadius: 4, border: 'none',
    background: 'transparent', cursor: 'pointer',
    fontSize: 10, fontWeight: 500, fontFamily: 'inherit',
    color: 'var(--color-text-secondary)', letterSpacing: '.3px',
    transition: 'all .1s',
  },
  levelBtnActive: {
    background: 'var(--color-background-primary)',
    color: '#111827',
    boxShadow: '0 1px 3px rgba(0,0,0,.1)',
  },
  iconBtn: {
    width: 28, height: 28, borderRadius: 'var(--border-radius-sm)',
    border: '0.5px solid var(--color-border-secondary)',
    background: 'var(--color-background-primary)',
    cursor: 'pointer', fontSize: 13, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    color: 'var(--color-text-secondary)', fontFamily: 'inherit',
  },
  statusBar: {
    fontSize: 11, marginBottom: 8, display: 'flex', alignItems: 'center',
  },
  logWrap: {
    overflowY: 'auto', overflowX: 'hidden',
    background: '#0f1923',
    borderRadius: 'var(--border-radius-md)',
    padding: '6px 0',
    fontFamily: 'var(--font-mono)',
  },
  entry: {
    display: 'flex', alignItems: 'baseline',
    gap: 6, padding: '3px 10px',
    borderBottom: '0.5px solid rgba(255,255,255,.04)',
    fontSize: 11, lineHeight: 1.5, background: 'transparent',
  },
  dot: {
    width: 6, height: 6, borderRadius: '50%',
    flexShrink: 0, marginTop: 2,
  },
  ts: {
    color: '#4b5563', flexShrink: 0, fontSize: 10,
    fontFamily: 'var(--font-mono)',
  },
  level: {
    fontSize: 10, fontWeight: 700, flexShrink: 0,
    minWidth: 54, letterSpacing: '.3px',
  },
  loggerName: {
    color: '#6b7280', fontSize: 10, flexShrink: 0, minWidth: 80,
  },
  message: {
    flex: 1, wordBreak: 'break-word', color: '#d1d5db',
  },
  empty: {
    padding: '24px', textAlign: 'center',
    color: '#4b5563', fontSize: 12,
  },
}
