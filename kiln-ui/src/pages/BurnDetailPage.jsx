import React, { useEffect, useState, useRef, useCallback } from 'react'
import { burnsApi, recipesApi, photosApi } from '../lib/api'
import { useLang } from '../i18n/index.jsx'
import { Button, Badge, Card } from '../components/UI'
import BurnChart from '../components/BurnChart'
import TempAlertsPanel from '../components/TempAlertsPanel'
import CommentsPanel from '../components/CommentsPanel'
import PhotosPanel from '../components/PhotosPanel'
import SystemLogPanel from '../components/SystemLogPanel'

const POLL_INTERVAL = 10000  // ms
const CHART_POINTS  = 500

export default function BurnDetailPage({ burnId, onBack, toast }) {
  const { t } = useLang()
  const [burn, setBurn]           = useState(null)
  const [chartData, setChartData] = useState(null)   // { points, total, from_min, to_min }
  const [logs, setLogs]           = useState([])     // paginated table rows
  const [logTotal, setLogTotal]   = useState(0)
  const [logPage, setLogPage]     = useState(1)
  const [logFromMin, setLogFromMin] = useState('')
  const [logToMin, setLogToMin]   = useState('')
  const [allRecipes, setAllRecipes] = useState([])
  const [addRecipeId, setAddRecipeId] = useState('')
  const [loading, setLoading]     = useState(true)
  const [chartLoading, setChartLoading] = useState(false)
  const [comments, setComments]   = useState([])
  const [photos, setPhotos]       = useState([])
  const [allTags, setAllTags]     = useState([])

  // Zoom state — null means full range
  const [zoom, setZoom]             = useState(null)
  const [viewMode, setViewMode]       = useState('full')   // 'follow' | 'full'
  const [windowMinutes, setWindowMinutes] = useState(60)
  const [isFullscreen, setIsFullscreen]   = useState(false)
  const chartCardRef = useRef(null)
  const lastIdRef = useRef(0)
  const pollRef   = useRef(null)

  // ── Initial load ────────────────────────────────────────
  async function load() {
    setLoading(true)
    try {
      const [b, all, cmts, pics, tgs] = await Promise.all([
        burnsApi.get(burnId),
        recipesApi.list(),
        burnsApi.getComments(burnId),
        photosApi.list({ burn_id: burnId }),
        photosApi.tags(),
      ])
      setBurn(b)
      setAllRecipes(all)
      setComments(cmts)
      setPhotos(pics)
      setAllTags(tgs)
      if (!addRecipeId && all.length) setAddRecipeId(String(all[0].id))
      await loadChart(null)
      await loadLogPage(1, '', '')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  // ── Chart data ───────────────────────────────────────────
  async function loadChart(zoomRange) {
    setChartLoading(true)
    try {
      // Use more points when zoomed to a narrow range for better resolution
      const pts = zoomRange && (zoomRange.to_min - zoomRange.from_min) < 30 ? 2000 : CHART_POINTS
      const params = new URLSearchParams({ max_points: pts })
      if (zoomRange) {
        params.set('from_min', zoomRange.from_min)
        params.set('to_min',   zoomRange.to_min)
      }
      const data = await fetch(`/api/burns/${burnId}/logs/chart?${params}`)
        .then(r => r.json())
      setChartData(data)
    } finally {
      setChartLoading(false)
    }
  }

  // ── Log table ────────────────────────────────────────────
  async function loadLogPage(page, fromMin, toMin) {
    const params = new URLSearchParams({ page, limit: 100, order: 'desc' })
    if (fromMin !== '') params.set('from_min', fromMin)
    if (toMin   !== '') params.set('to_min',   toMin)
    const rows = await fetch(`/api/burns/${burnId}/logs?${params}`).then(r => r.json())
    setLogs(rows)
    setLogPage(page)
  }

  // ── Live polling ─────────────────────────────────────────
  const poll = useCallback(async () => {
    try {
      const b = await burnsApi.get(burnId)
      setBurn(b)
      if (b.status !== 'running') return

      const data = await fetch(
        `/api/burns/${burnId}/logs/latest?after_id=${lastIdRef.current}`
      ).then(r => r.json())

      if (data.count > 0) {
        lastIdRef.current = data.rows[data.rows.length - 1].id
        // Refresh chart with current zoom
        await loadChart(zoom)
        // Refresh first page of log table
        await loadLogPage(1, logFromMin, logToMin)
      }
    } catch (e) {
      // silent — don't spam toasts during polling
    }
  }, [burnId, zoom, logFromMin, logToMin])

  // ── Zoom handler ─────────────────────────────────────────
  function toggleFullscreen() {
    const el = chartCardRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  async function handleZoom(fromMin, toMin) {
    const z = { from_min: fromMin, to_min: toMin }
    setZoom(z)
    setLogFromMin(String(fromMin.toFixed(1)))
    setLogToMin(String(toMin.toFixed(1)))
    await Promise.all([
      loadChart(z),
      loadLogPage(1, fromMin, toMin),
    ])
  }

  async function handleZoomReset() {
    setZoom(null)
    setLogFromMin('')
    setLogToMin('')
    await Promise.all([
      loadChart(null),
      loadLogPage(1, '', ''),
    ])
  }

  // ── Log filter ────────────────────────────────────────────
  async function handleLogFilter() {
    const f = parseFloat(logFromMin)
    const t = parseFloat(logToMin)
    if (!isNaN(f) && !isNaN(t) && t > f) {
      const z = { from_min: f, to_min: t }
      setZoom(z)
      await Promise.all([loadChart(z), loadLogPage(1, f, t)])
    } else {
      await loadLogPage(1, logFromMin, logToMin)
    }
  }

  // ── Effects ──────────────────────────────────────────────
  useEffect(() => {
    if (burnId) load()
  }, [burnId])

  useEffect(() => {
    if (!burn) return
    if (burn.status === 'running') {
      pollRef.current = setInterval(poll, POLL_INTERVAL)
    }
    return () => clearInterval(pollRef.current)
  }, [burn?.status, poll])

  // Track last log id for polling
  useEffect(() => {
    if (logs.length) {
      const maxId = Math.max(...logs.map(l => l.id))
      if (maxId > lastIdRef.current) lastIdRef.current = maxId
    }
  }, [logs])

  // ── Burn actions ─────────────────────────────────────────
  async function handleStart(test = false) {
    try { await burnsApi.start(burnId, test); toast(test ? t('burn_test_data') : t('burn_started')); load() }
    catch(e) { toast(e.message, 'error') }
  }
  async function handleSimulate() {
    try { await burnsApi.simulate(burnId, 60); toast(t('burn_simulated')); load() }
    catch(e) { toast(e.message, 'error') }
  }
  async function handleComplete() {
    try { await burnsApi.complete(burnId); toast(t('burn_completed')); load() }
    catch(e) { toast(e.message, 'error') }
  }
  async function handleAbort() {
    if (!confirm(t('confirm_abort'))) return
    try { await burnsApi.abort(burnId); toast(t('burn_aborted')); load() }
    catch(e) { toast(e.message, 'error') }
  }
  async function handleAddRecipe() {
    if (!addRecipeId) return
    try { await burnsApi.addRecipe(burnId, { recipe_id: +addRecipeId, notes: '' }); toast(t('recipe_saved')); load() }
    catch(e) { toast(e.message, 'error') }
  }
  async function handleRemoveRecipe(brId) {
    try { await burnsApi.removeRecipe(burnId, brId); toast(t('recipe_deleted')); load() }
    catch(e) { toast(e.message, 'error') }
  }

  if (loading) return <div style={{ color: 'var(--color-text-secondary)', padding: 24 }}>Loading…</div>
  if (!burn)   return null

  const lastPoint  = chartData?.points?.[chartData.points.length - 1]
  const currentMin = lastPoint?.elapsed_minutes ?? null

  return (
    <div>
      <button onClick={onBack} style={styles.backBtn}>← Back to Burns</button>

      {/* Title */}
      <div style={styles.topRow}>
        <div>
          <h1 style={styles.title}>{burn.name}</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
            <Badge status={burn.status} />
            <span style={styles.tag}>{burn.kiln.name}</span>
            <span style={styles.tag}>{burn.template.name}</span>
            {burn.resume_on_power_loss && (
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99,
                background: '#d1fae5', color: '#065f46', border: '0.5px solid #6ee7b7' }}
                title={`Återupptas om strömmen kommer tillbaka inom ${burn.resume_timeout_minutes} min`}
              >
                ⚡ Återupptas vid strömavbrott ({burn.resume_timeout_minutes} min)
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {burn.status === 'pending' && <>
            <Button variant="success" onClick={() => handleStart(false)}>▶ Start</Button>
            <Button variant="ghost"   onClick={() => handleStart(true)}  style={{ fontSize: 12 }}>🧪 Instant data</Button>
            <Button variant="ghost"   onClick={handleSimulate}           style={{ fontSize: 12 }}>⚡ Simulate 60x</Button>
          </>}
          {burn.status === 'running' && <>
            <Button variant="ghost"  onClick={handleComplete}>✓ Complete</Button>
            <Button variant="danger" onClick={handleAbort}>✕ Abort</Button>
          </>}
        </div>
      </div>

      {/* Live stats */}
      {lastPoint && (
        <div style={styles.statsRow}>
          <StatCard label="Actual Temp"  value={`${lastPoint.actual_temp.toFixed(1)}°C`} accent="var(--danger)" />
          <StatCard label="Target Temp"  value={`${lastPoint.target_temp.toFixed(1)}°C`} accent="#1e6fbf" />
          <StatCard label="Elapsed"      value={`${lastPoint.elapsed_minutes.toFixed(0)} min`} />
          <StatCard label="Total Points" value={chartData?.total?.toLocaleString() ?? '–'} />
        </div>
      )}

      {/* PID chips */}
      <Card style={{ marginBottom: 20 }}>
        <div style={styles.sectionLabel}>PID Values (this burn)</div>
        <div style={styles.pidRow}>
          <PidChip label="Kp" value={burn.pid_kp_used ?? burn.kiln.pid_kp} />
          <PidChip label="Ki" value={burn.pid_ki_used ?? burn.kiln.pid_ki} />
          <PidChip label="Kd" value={burn.pid_kd_used ?? burn.kiln.pid_kd} />
          <div style={{ width: 1, background: 'var(--color-border-tertiary)', alignSelf: 'stretch', margin: '0 4px' }} />
          <PidChip label="Sensor"  value={burn.kiln.sensor_type}              mono={false} />
          <PidChip label="Cutoff"  value={`${burn.kiln.safety_cutoff_temp}°C`} mono={false} />
          <PidChip label="Heater"  value={`GPIO ${burn.kiln.pin_heater}`}      mono={false} />
        </div>
      </Card>

      {/* Chart */}
      <Card ref={chartCardRef} style={{ marginBottom: 20 }}>
      <style>{`
        :fullscreen { background: #1a1a2e !important; overflow: auto; }
        :-webkit-full-screen { background: #1a1a2e !important; overflow: auto; }
        :fullscreen .fullscreen-chart-inner { padding: 20px; }
        :-webkit-full-screen .fullscreen-chart-inner { padding: 20px; }
        :fullscreen .fs-controls { background: #1a1a2e !important; }
        :-webkit-full-screen .fs-controls { background: #1a1a2e !important; }
      `}</style>
      <div className="fullscreen-chart-inner">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={styles.sectionLabel}>
            Temperature vs Time
            {chartData && (
              <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
                {chartData.sampled} of {chartData.total?.toLocaleString()} points
                {zoom && ` · zoomed ${zoom.from_min.toFixed(0)}–${zoom.to_min.toFixed(0)} min`}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {zoom && <Button size="sm" variant="ghost" onClick={handleZoomReset}>Reset zoom</Button>}
            {chartLoading && <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Loading…</span>}
          </div>
        </div>

        {/* Chart controls */}
        <div className="fs-controls" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', padding: isFullscreen ? '0 0 10px 0' : 0 }}>
          {/* View mode toggle */}
          <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '0.5px solid var(--color-border-secondary)' }}>
            <button
              onClick={() => setViewMode('follow')}
              style={{ ...styles.modeBtn, background: viewMode === 'follow' ? '#1e6fbf' : 'var(--color-background-primary)', color: viewMode === 'follow' ? '#fff' : 'var(--color-text-secondary)' }}
            >
              ⟳ Följ
            </button>
            <button
              onClick={() => setViewMode('full')}
              style={{ ...styles.modeBtn, background: viewMode === 'full' ? '#1e6fbf' : 'var(--color-background-primary)', color: viewMode === 'full' ? '#fff' : 'var(--color-text-secondary)', borderLeft: '0.5px solid var(--color-border-secondary)' }}
            >
              ⊞ Hela mallen
            </button>
          </div>

          {/* Window size (follow mode only) */}
          {viewMode === 'follow' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>±</span>
              <input
                type="number" min="5" max="480" step="5"
                value={windowMinutes}
                onChange={e => setWindowMinutes(+e.target.value)}
                style={styles.windowInput}
              />
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>min</span>
            </div>
          )}

          {/* Zoom controls */}
          <ZoomInputs onZoom={handleZoom} onReset={handleZoomReset} isZoomed={!!zoom} zoom={zoom} />

          {/* Fullscreen button */}
          <button onClick={toggleFullscreen} style={styles.fsBtn} title="Fullskärm">
            {isFullscreen ? '⛶' : '⛶'}
            {isFullscreen ? ' Avsluta' : ' Fullskärm'}
          </button>
        </div>

        <BurnChart
          segments={burn.template.segments || []}
          points={chartData?.points || []}
          comments={comments}
          currentMin={currentMin}
          viewMode={viewMode}
          zoomRange={zoom}
          windowMinutes={windowMinutes}
          onZoom={handleZoom}
        />
      </div>
      </Card>

      {/* Temp alerts */}
      <TempAlertsPanel
        burnId={burnId}
        alerts={burn.temp_alerts || []}
        segments={burn.template.segments || []}
        onRefresh={load}
        toast={toast}
      />

      {/* Recipes */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={styles.sectionLabel}>Glaze Recipes</div>
          {allRecipes.length > 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select value={addRecipeId} onChange={e => setAddRecipeId(e.target.value)} style={styles.inlineSelect}>
                {allRecipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <Button size="sm" variant="primary" onClick={handleAddRecipe}>+ Add</Button>
            </div>
          )}
        </div>
        {(!burn.recipes || burn.recipes.length === 0) ? (
          <div style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>No recipes attached yet.</div>
        ) : burn.recipes.map(br => (
          <div key={br.id} style={styles.recipeRow}>
            <div>
              <span style={{ fontWeight: 500, fontSize: 13 }}>{br.recipe.name}</span>
              <div style={{ display: 'flex', gap: 5, marginTop: 3 }}>
                {br.recipe.cone    && <RecipePill>{br.recipe.cone}</RecipePill>}
                {br.recipe.surface && <RecipePill>{br.recipe.surface}</RecipePill>}
                {br.recipe.color   && <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>→ {br.recipe.color}</span>}
              </div>
            </div>
            <Button size="sm" variant="danger" onClick={() => handleRemoveRecipe(br.id)}>Remove</Button>
          </div>
        ))}
      </Card>

      {/* Photos */}
      <PhotosPanel
        photos={photos}
        burnId={burnId}
        existingTags={allTags}
        onRefresh={load}
        toast={toast}
      />

      {/* Comments */}
      <CommentsPanel
        burnId={burnId}
        comments={comments}
        currentMin={chartData?.points?.length ? chartData.points[chartData.points.length-1].elapsed_minutes : null}
        onRefresh={load}
        toast={toast}
      />

      {/* System log */}
      <SystemLogPanel
        burnId={burnId}
        running={burn?.status === 'running'}
      />

      {/* Log table */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
          <div style={styles.sectionLabel}>
            Burn Log
            <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
              showing {logs.length} rows · page {logPage}
            </span>
          </div>
          {/* Time filter */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Filter:</span>
            <input type="number" placeholder="From min" style={styles.zoomInput}
              value={logFromMin} onChange={e => setLogFromMin(e.target.value)} />
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>–</span>
            <input type="number" placeholder="To min" style={styles.zoomInput}
              value={logToMin} onChange={e => setLogToMin(e.target.value)} />
            <Button size="sm" variant="ghost" onClick={handleLogFilter}>Filter</Button>
            {(logFromMin || logToMin) && (
              <Button size="sm" variant="ghost" onClick={() => { setLogFromMin(''); setLogToMin(''); loadLogPage(1,'','') }}>✕ Clear</Button>
            )}
          </div>
        </div>

        {logs.length === 0 ? (
          <div style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
            No log entries yet.
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto', maxHeight: 400, overflowY: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {[t('elapsed'), t('col_actual'), t('col_target'), t('col_duty'), 'P', 'I', 'D', 'Event'].map(h => (
                      <th key={h} style={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map(l => (
                    <tr key={l.id} style={{ background: l.event ? 'rgba(30,111,191,.04)' : undefined }}>
                      <td style={styles.tdMono}>{l.elapsed_minutes.toFixed(1)} min</td>
                      <td style={{ ...styles.tdMono, color: '#dc2626', fontWeight: 600 }}>{l.actual_temp.toFixed(1)}</td>
                      <td style={{ ...styles.tdMono, color: '#1e6fbf' }}>{l.target_temp.toFixed(1)}</td>
                      <td style={styles.tdMono}>{l.duty_cycle.toFixed(1)}</td>
                      <td style={styles.tdMono}>{l.pid_p.toFixed(3)}</td>
                      <td style={styles.tdMono}>{l.pid_i.toFixed(3)}</td>
                      <td style={styles.tdMono}>{l.pid_d.toFixed(3)}</td>
                      <td style={styles.td}>
                        {l.event && <span style={styles.eventBadge}>{l.event}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
              <Button size="sm" variant="ghost"
                disabled={logPage <= 1}
                onClick={() => loadLogPage(logPage - 1, logFromMin, logToMin)}>
                ← Prev
              </Button>
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Page {logPage}</span>
              <Button size="sm" variant="ghost"
                disabled={logs.length < 100}
                onClick={() => loadLogPage(logPage + 1, logFromMin, logToMin)}>
                Next →
              </Button>
              <Button size="sm" variant="ghost"
                onClick={() => loadLogPage(1, logFromMin, logToMin)}>
                ↑ Latest
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

// ── Small components ──────────────────────────────────────

function RecipePill({ children }) {
  return (
    <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 99,
      background: 'var(--color-background-secondary)',
      border: '0.5px solid var(--color-border-tertiary)',
      color: 'var(--color-text-secondary)' }}>
      {children}
    </span>
  )
}

function StatCard({ label, value, accent = 'var(--color-text-primary)' }) {
  return (
    <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)',
      borderRadius: 'var(--border-radius-lg)', padding: '14px 18px',
      display: 'flex', flexDirection: 'column', gap: 4, boxShadow: 'var(--shadow-sm)' }}>
      <span style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--color-text-secondary)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 500, color: accent, letterSpacing: '-1px' }}>{value}</span>
    </div>
  )
}

function PidChip({ label, value, mono = true }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--color-text-secondary)' }}>{label}</span>
      <span style={{ fontFamily: mono ? 'var(--font-mono)' : 'var(--font)', fontSize: 16, fontWeight: 500, color: '#1e6fbf' }}>{value}</span>
    </div>
  )
}

function ZoomInputs({ onZoom, onReset, isZoomed, zoom }) {
  const [from, setFrom] = useState(zoom?.from_min ?? '')
  const [to,   setTo]   = useState(zoom?.to_min   ?? '')

  // Sync inputs when zoom is reset externally
  React.useEffect(() => {
    if (!zoom) { setFrom(''); setTo('') }
    else { setFrom(zoom.from_min ?? ''); setTo(zoom.to_min ?? '') }
  }, [zoom])

  function handleGo() {
    const f = parseFloat(from)
    const t = parseFloat(to)
    if (!isNaN(f) && !isNaN(t) && t > f) onZoom(f, t)
  }

  function handleReset() {
    setFrom(''); setTo('')
    onReset()
  }

  return (
    <div style={styles.zoomRow}>
      <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Zoom to range:</span>
      <input
        type="number" placeholder="From min" style={styles.zoomInput}
        value={from}
        onChange={e => setFrom(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleGo()}
      />
      <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>–</span>
      <input
        type="number" placeholder="To min" style={styles.zoomInput}
        value={to}
        onChange={e => setTo(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleGo()}
      />
      <Button size="sm" variant="ghost" onClick={handleGo}
        disabled={from === '' || to === '' || parseFloat(to) <= parseFloat(from)}>
        Go
      </Button>
      {isZoomed && <Button size="sm" variant="ghost" onClick={handleReset}>✕ Reset</Button>}
    </div>
  )
}

const styles = {
  backBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)',
    fontSize: 13, fontWeight: 500, padding: '0 0 20px', display: 'flex', alignItems: 'center',
    gap: 4, fontFamily: 'var(--font)' },
  topRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    marginBottom: 24, flexWrap: 'wrap', gap: 12 },
  title: { fontSize: 24, fontWeight: 500, letterSpacing: '-.4px', color: 'var(--color-text-primary)' },
  tag: { display: 'inline-block', fontSize: 12, padding: '2px 10px',
    background: 'var(--color-background-secondary)', border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 99, color: 'var(--color-text-secondary)' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px,1fr))', gap: 12, marginBottom: 20 },
  sectionLabel: { fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '1px',
    color: 'var(--color-text-secondary)', marginBottom: 0 },
  pidRow: { display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' },
  zoomRow: { display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' },
  zoomInput: { width: 80, padding: '5px 8px', fontSize: 12, fontFamily: 'var(--font-mono)',
    background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 'var(--border-radius-sm)', color: 'var(--color-text-primary)', outline: 'none' },
  inlineSelect: { background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 'var(--border-radius-md)', padding: '5px 10px', fontSize: 12,
    color: 'var(--color-text-primary)', fontFamily: 'var(--font)' },
  recipeRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 14px', borderRadius: 'var(--border-radius-md)',
    background: 'var(--color-background-secondary)', marginBottom: 8 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { padding: '8px 10px', fontSize: 10, fontWeight: 500, textTransform: 'uppercase',
    letterSpacing: '.8px', color: 'var(--color-text-secondary)', background: 'var(--color-background-secondary)',
    textAlign: 'right', borderBottom: '0.5px solid var(--color-border-tertiary)',
    position: 'sticky', top: 0, whiteSpace: 'nowrap' },
  td:     { padding: '6px 10px', borderTop: '0.5px solid var(--color-border-tertiary)', textAlign: 'right', color: 'var(--color-text-secondary)' },
  tdMono: { padding: '6px 10px', borderTop: '0.5px solid var(--color-border-tertiary)', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' },
  modeBtn: {
    padding: '5px 12px', border: 'none', cursor: 'pointer',
    fontSize: 12, fontFamily: 'var(--font)', fontWeight: 500,
    transition: 'all .15s',
  },
  windowInput: {
    width: 60, padding: '4px 7px', fontSize: 12,
    fontFamily: 'var(--font-mono)',
    background: 'var(--color-background-primary)',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 6, color: 'var(--color-text-primary)', outline: 'none',
  },
  fsBtn: {
    marginLeft: 'auto', padding: '5px 12px', borderRadius: 6,
    border: '1px solid #3b82f6',
    background: '#1e6fbf',
    color: '#ffffff',
    cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font)',
    display: 'flex', alignItems: 'center', gap: 4,
    fontWeight: 500,
  },
  eventBadge: { display: 'inline-block', fontSize: 11, padding: '2px 8px', borderRadius: 4,
    background: '#eff6ff', color: '#1e6fbf', fontWeight: 500 },
}
