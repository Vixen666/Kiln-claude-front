import React, { useEffect, useRef, useState, useCallback } from 'react'

/**
 * BurnChart
 * Props:
 *   segments      — template curve segments (full template for target line)
 *   points        — [{elapsed_minutes, actual_temp, target_temp, event}]
 *   comments      — [{elapsed_minutes, text}]
 *   currentMin    — current elapsed minutes (for following window marker)
 *   viewMode      — 'follow' | 'full'
 *   windowMinutes — ± minutes around currentMin in follow mode
 *   onZoom        — (from_min, to_min) => void
 */

function clipCurve(points, xMin, xMax) {
  if (!points.length) return []
  function interp(a, b, x) {
    if (b.x === a.x) return a.y
    return a.y + (b.y - a.y) * ((x - a.x) / (b.x - a.x))
  }
  const result = []
  for (let i = 0; i < points.length; i++) {
    const p = points[i], prev = points[i - 1]
    if (prev && prev.x < xMin && p.x >= xMin)
      result.push({ x: xMin, y: interp(prev, p, xMin) })
    if (p.x >= xMin && p.x <= xMax)
      result.push(p)
    if (prev && prev.x <= xMax && p.x > xMax)
      result.push({ x: xMax, y: interp(prev, p, xMax) })
  }
  if (!result.length && points.length >= 2) {
    for (let i = 1; i < points.length; i++) {
      const a = points[i-1], b = points[i]
      if (a.x <= xMin && b.x >= xMax)
        return [{ x: xMin, y: interp(a, b, xMin) }, { x: xMax, y: interp(a, b, xMax) }]
    }
  }
  return result
}

// Build full target polyline from segments
function buildFullTarget(segments) {
  const pts = []
  let t = 0
  for (const s of segments) {
    pts.push({ x: t, y: s.start_temp })
    t += s.duration_minutes
    pts.push({ x: t, y: s.end_temp })
    if (s.hold_minutes > 0) {
      t += s.hold_minutes
      pts.push({ x: t, y: s.end_temp })
    }
  }
  return { pts, totalMin: t }
}

const tipRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginBottom: 3 }

export default function BurnChart({
  segments = [], points = [], comments = [],
  currentMin = null, viewMode = 'full',
  zoomRange = null, windowMinutes = 60, onZoom,
}) {
  const canvasRef  = useRef(null)
  const wrapRef    = useRef(null)
  const dragRef    = useRef(null)
  const layoutRef  = useRef(null)
  const [dragBox, setDragBox] = useState(null)
  const [hover, setHover]     = useState(null)  // { x, point, targetTemp }

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    const W   = (wrapRef.current?.offsetWidth) || canvas.parentElement?.offsetWidth || 700
    const isFS = !!document.fullscreenElement
    const H   = isFS ? window.innerHeight - 80 : 280
    canvas.width  = W * dpr
    canvas.height = H * dpr
    canvas.style.width  = W + 'px'
    canvas.style.height = H + 'px'

    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)

    const PAD = { top: 24, right: 24, bottom: 44, left: 58 }
    const cw  = W - PAD.left - PAD.right
    const ch  = H - PAD.top  - PAD.bottom

    const { pts: fullTarget, totalMin } = buildFullTarget(segments)

    // ── Determine X window ─────────────────────────────
    let xMin, xMax
    if (zoomRange) {
      xMin = zoomRange.from_min
      xMax = zoomRange.to_min
    } else if (viewMode === 'follow') {
      const center = currentMin ?? (points.length ? points[points.length-1].elapsed_minutes : 30)
      xMin = Math.max(0, center - windowMinutes)
      xMax = Math.max(xMin + windowMinutes * 0.5, center + windowMinutes)
    } else {
      xMin = 0
      xMax = Math.max(totalMin, points.length ? points[points.length-1].elapsed_minutes : 60, 60)
    }

    // Clip target to window
    const targetCurve = clipCurve(fullTarget, xMin, xMax)

    // Visible actual points
    const visiblePoints = points.filter(p =>
      (p.elapsed_minutes) >= xMin && (p.elapsed_minutes) <= xMax
    )

    // ── Y range: auto-scale to visible data ± 5% ──────
    const allVisY = [
      ...targetCurve.map(p => p.y),
      ...visiblePoints.map(p => p.actual_temp),
      ...visiblePoints.map(p => p.target_temp),
    ]
    let yMin, yMax
    if (allVisY.length) {
      const lo = Math.min(...allVisY)
      const hi = Math.max(...allVisY)
      const pad = Math.max((hi - lo) * 0.08, 20)
      yMin = Math.max(0, lo - pad)
      yMax = hi + pad
    } else {
      yMin = 0; yMax = 100
    }

    const px = x => PAD.left + ((x - xMin) / (xMax - xMin)) * cw
    const py = y => PAD.top  + ch - ((y - yMin) / (yMax - yMin)) * ch

    layoutRef.current = { px, py, PAD, cw, ch, xMin, xMax, yMin, yMax, W, H }

    // ── Background ─────────────────────────────────────
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, W, H)

    // ── Grid ──────────────────────────────────────────
    const yTicks = 6, xTicks = 7
    for (let i = 0; i <= yTicks; i++) {
      const y = PAD.top + (ch / yTicks) * i
      ctx.strokeStyle = '#f0f0f0'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + cw, y); ctx.stroke()
      const val = Math.round(yMax - (yMax - yMin) / yTicks * i)
      ctx.fillStyle = '#9ca3af'; ctx.font = '10px DM Mono,monospace'
      ctx.textAlign = 'right'; ctx.fillText(val + '°', PAD.left - 6, y + 4)
    }
    for (let i = 0; i <= xTicks - 1; i++) {
      const x = PAD.left + (cw / (xTicks - 1)) * i
      ctx.strokeStyle = '#f0f0f0'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(x, PAD.top); ctx.lineTo(x, PAD.top + ch); ctx.stroke()
      const val = Math.round(xMin + (xMax - xMin) / (xTicks - 1) * i)
      ctx.fillStyle = '#9ca3af'; ctx.font = '10px DM Mono,monospace'
      ctx.textAlign = 'center'; ctx.fillText(val + ' min', x, PAD.top + ch + 18)
    }

    // ── Axes ──────────────────────────────────────────
    ctx.strokeStyle = '#d1d5db'; ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(PAD.left, PAD.top)
    ctx.lineTo(PAD.left, PAD.top + ch)
    ctx.lineTo(PAD.left + cw, PAD.top + ch)
    ctx.stroke()

    // ── "Elapsed so far" shading in full mode ──────────
    if (viewMode === 'full' && currentMin != null) {
      const elapsedX = Math.min(px(currentMin), PAD.left + cw)
      ctx.fillStyle = 'rgba(249,115,22,0.04)'
      ctx.fillRect(PAD.left, PAD.top, elapsedX - PAD.left, ch)
      // Vertical "now" line
      ctx.strokeStyle = 'rgba(249,115,22,0.4)'
      ctx.lineWidth = 1.5
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(elapsedX, PAD.top)
      ctx.lineTo(elapsedX, PAD.top + ch)
      ctx.stroke()
      ctx.setLineDash([])
      // "NOW" label
      ctx.fillStyle = '#f97316'
      ctx.font = 'bold 9px DM Sans,sans-serif'
      ctx.textAlign = elapsedX > PAD.left + cw * 0.8 ? 'right' : 'left'
      ctx.fillText('NOW', elapsedX + (elapsedX > PAD.left + cw * 0.8 ? -4 : 4), PAD.top + 12)
    }

    // ── Target line (drawn FIRST, underneath actual) ───
    if (targetCurve.length > 1) {
      ctx.beginPath(); ctx.setLineDash([7, 4])
      ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 2
      targetCurve.forEach((p, i) =>
        i === 0 ? ctx.moveTo(px(p.x), py(p.y)) : ctx.lineTo(px(p.x), py(p.y))
      )
      ctx.stroke(); ctx.setLineDash([])
    }

    // ── Actual: filled area + line ON TOP ─────────────
    if (visiblePoints.length > 1) {
      const baseY = PAD.top + ch

      // Filled area under actual
      ctx.beginPath()
      visiblePoints.forEach((p, i) => {
        const x = px(p.elapsed_minutes), y = py(p.actual_temp)
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      })
      // Close path along bottom
      ctx.lineTo(px(visiblePoints[visiblePoints.length-1].elapsed_minutes), baseY)
      ctx.lineTo(px(visiblePoints[0].elapsed_minutes), baseY)
      ctx.closePath()
      const grad = ctx.createLinearGradient(0, PAD.top, 0, baseY)
      grad.addColorStop(0, 'rgba(249,115,22,0.28)')
      grad.addColorStop(1, 'rgba(249,115,22,0.02)')
      ctx.fillStyle = grad
      ctx.fill()

      // Actual line on top of the fill
      ctx.beginPath()
      ctx.strokeStyle = '#ea580c'; ctx.lineWidth = 2.5
      visiblePoints.forEach((p, i) => {
        const x = px(p.elapsed_minutes), y = py(p.actual_temp)
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      })
      ctx.stroke()
    }

    // ── Catch-up phase shading ────────────────────────
    // Find catch_up_start/end events and shade those regions
    let inCatchUp = false
    let catchUpStartX = null
    for (const p of visiblePoints) {
      const x = px(p.elapsed_minutes)
      if (p.event && p.event.startsWith('catch_up_start')) {
        inCatchUp = true
        catchUpStartX = x
      } else if (p.event === 'catch_up_end' && inCatchUp) {
        // Shade this catch-up region
        ctx.fillStyle = 'rgba(245,158,11,0.10)'
        ctx.fillRect(catchUpStartX, PAD.top, x - catchUpStartX, ch)
        // Label
        ctx.fillStyle = '#d97706'
        ctx.font = '9px DM Sans,sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('catch-up', catchUpStartX + (x - catchUpStartX) / 2, PAD.top + 10)
        inCatchUp = false
        catchUpStartX = null
      }
    }
    // Still in catch-up at end of visible range
    if (inCatchUp && catchUpStartX !== null) {
      ctx.fillStyle = 'rgba(245,158,11,0.10)'
      ctx.fillRect(catchUpStartX, PAD.top, PAD.left + cw - catchUpStartX, ch)
    }

    // ── Event markers ─────────────────────────────────
    visiblePoints.filter(p => p.event).forEach(p => {
      const x = px(p.elapsed_minutes), y = py(p.actual_temp)
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#1e6fbf'; ctx.fill()
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke()
    })

    // ── Comment markers ────────────────────────────────
    comments.filter(cm => cm.elapsed_minutes != null &&
      cm.elapsed_minutes >= xMin && cm.elapsed_minutes <= xMax
    ).forEach(cm => {
      const x = px(cm.elapsed_minutes)
      ctx.setLineDash([3, 3])
      ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(x, PAD.top); ctx.lineTo(x, PAD.top + ch)
      ctx.stroke(); ctx.setLineDash([])
      ctx.beginPath(); ctx.arc(x, PAD.top + 6, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#f59e0b'; ctx.fill()
      const label = cm.text.length > 22 ? cm.text.slice(0, 22) + '…' : cm.text
      ctx.fillStyle = '#92400e'; ctx.font = '10px DM Sans,sans-serif'
      ctx.textAlign = x > PAD.left + cw / 2 ? 'right' : 'left'
      ctx.fillText(label, x + (x > PAD.left + cw / 2 ? -8 : 8), PAD.top + 18)
    })

    // ── Legend ─────────────────────────────────────────
    const lY = PAD.top + 9
    // Target
    ctx.setLineDash([7,4]); ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(PAD.left+4, lY); ctx.lineTo(PAD.left+20, lY); ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = '#6b7280'; ctx.font = '11px DM Sans,sans-serif'; ctx.textAlign = 'left'
    ctx.fillText('Mål', PAD.left + 24, lY + 4)
    // Actual
    ctx.strokeStyle = '#ea580c'; ctx.lineWidth = 2.5
    ctx.beginPath(); ctx.moveTo(PAD.left+52, lY); ctx.lineTo(PAD.left+68, lY); ctx.stroke()
    ctx.fillText('Faktisk', PAD.left + 72, lY + 4)

    if (onZoom) {
      ctx.fillStyle = '#c4c4c4'; ctx.font = '9px DM Sans,sans-serif'; ctx.textAlign = 'right'
      ctx.fillText('dra för zoom', PAD.left + cw, lY + 4)
    }

  }, [segments, points, comments, currentMin, viewMode, windowMinutes])

  // Draw hover crosshair on a separate effect so it doesn't re-render the whole chart
  useEffect(() => {
    if (!hover || !layoutRef.current) return
    // We draw the crosshair as an overlay div instead of canvas to avoid re-rendering
  }, [hover])

  useEffect(() => { draw() }, [draw])

  // Redraw on resize
  useEffect(() => {
    const ro = new ResizeObserver(() => draw())
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [draw])

  // ── Drag-to-zoom ──────────────────────────────────────
  function canvasXToMin(clientX) {
    const layout = layoutRef.current
    if (!layout) return 0
    const rect = canvasRef.current.getBoundingClientRect()
    const x = clientX - rect.left - layout.PAD.left
    return layout.xMin + (x / layout.cw) * (layout.xMax - layout.xMin)
  }

  function getHoverData(clientX) {
    const layout = layoutRef.current
    if (!layout || !points.length) return null
    const rect = canvasRef.current.getBoundingClientRect()
    const canvasX = clientX - rect.left
    const { px, PAD, cw, xMin, xMax } = layout
    if (canvasX < PAD.left || canvasX > PAD.left + cw) return null

    // Convert canvas X to minutes
    const hoverMin = xMin + ((canvasX - PAD.left) / cw) * (xMax - xMin)

    // Find closest point
    let closest = null
    let minDist = Infinity
    for (const p of points) {
      const d = Math.abs(p.elapsed_minutes - hoverMin)
      if (d < minDist) { minDist = d; closest = p }
    }
    if (!closest) return null

    // Get target temp from curve at this elapsed time
    const { pts: fullTarget } = buildFullTarget(segments)
    let targetTemp = closest.target_temp
    if (fullTarget.length > 1) {
      for (let i = 1; i < fullTarget.length; i++) {
        const a = fullTarget[i-1], b = fullTarget[i]
        if (hoverMin >= a.x && hoverMin <= b.x) {
          const frac = (hoverMin - a.x) / (b.x - a.x)
          targetTemp = a.y + (b.y - a.y) * frac
          break
        }
      }
    }

    // Find segment name
    let segLabel = ''
    let elapsed = 0
    for (const seg of segments) {
      const segEnd = elapsed + seg.duration_minutes + (seg.hold_minutes || 0)
      if (hoverMin <= segEnd) {
        segLabel = seg.label || ''
        break
      }
      elapsed = segEnd
    }

    return { hoverMin, point: closest, targetTemp: Math.round(targetTemp * 10) / 10, segLabel, canvasX }
  }

  function onMouseDown(e) {
    if (!onZoom) return
    const rect = canvasRef.current.getBoundingClientRect()
    dragRef.current = { startX: e.clientX, startPx: e.clientX - rect.left }
    setDragBox({ left: e.clientX - rect.left, width: 0 })
  }
  function onMouseMove(e) {
    const hd = getHoverData(e.clientX)
    setHover(hd)
    if (!dragRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const curPx = e.clientX - rect.left
    setDragBox({ left: Math.min(dragRef.current.startPx, curPx), width: Math.abs(curPx - dragRef.current.startPx) })
  }
  function onMouseUp(e) {
    if (!dragRef.current || !onZoom) return
    const lo = Math.max(0, Math.min(canvasXToMin(dragRef.current.startX), canvasXToMin(e.clientX)))
    const hi = Math.max(canvasXToMin(dragRef.current.startX), canvasXToMin(e.clientX))
    dragRef.current = null; setDragBox(null)
    if (hi - lo > 0.5) onZoom(lo, hi)
  }
  function onMouseLeave() { dragRef.current = null; setDragBox(null); setHover(null) }

  return (
    <div ref={wrapRef} style={{ position: 'relative', userSelect: 'none', width: '100%' }}>
      <canvas ref={canvasRef} style={{ width: '100%', display: 'block' }} />
      {/* Hover overlay — handles mouse events and shows tooltip */}
      <div style={{ position: 'absolute', inset: 0, cursor: onZoom ? 'crosshair' : 'default' }}
        onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}
        onMouseDown={onZoom ? onMouseDown : undefined}
        onMouseUp={onZoom ? onMouseUp : undefined}
      >
        {/* Crosshair + tooltip */}
        {hover && (() => {
          const layout = layoutRef.current
          if (!layout) return null
          const { px, py, PAD, ch, xMin, xMax, yMin, yMax, W, H } = layout
          const x = px(hover.point.elapsed_minutes)
          const diff = hover.point.actual_temp - hover.targetTemp
          const diffStr = (diff >= 0 ? '+' : '') + diff.toFixed(1) + '°C'
          const diffColor = Math.abs(diff) < 5 ? '#059669' : Math.abs(diff) < 25 ? '#d97706' : '#dc2626'
          // Position tooltip left or right of cursor
          const tipLeft = x > W * 0.6
          return (
            <>
              {/* Vertical line */}
              <div style={{
                position: 'absolute',
                left: x, top: PAD.top, bottom: H - PAD.top - ch,
                width: 1, background: 'rgba(100,100,100,.4)',
                pointerEvents: 'none',
              }} />
              {/* Dot on actual temp */}
              {(() => {
                const dotY = py(hover.point.actual_temp)
                return <div style={{
                  position: 'absolute',
                  left: x - 4, top: dotY - 4,
                  width: 8, height: 8, borderRadius: '50%',
                  background: '#ea580c', border: '2px solid #fff',
                  boxShadow: '0 0 4px rgba(0,0,0,.3)',
                  pointerEvents: 'none',
                }} />
              })()}
              {/* Tooltip */}
              <div style={{
                position: 'absolute',
                left: tipLeft ? x - 170 : x + 12,
                top: Math.max(PAD.top, Math.min(py(hover.point.actual_temp) - 60, H - 160)),
                width: 158,
                background: 'rgba(15,25,35,.92)',
                backdropFilter: 'blur(4px)',
                border: '0.5px solid rgba(255,255,255,.15)',
                borderRadius: 8,
                padding: '10px 12px',
                pointerEvents: 'none',
                zIndex: 10,
              }}>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6, fontFamily: 'monospace' }}>
                  {hover.point.elapsed_minutes.toFixed(1)} min
                  {hover.segLabel && <span style={{ marginLeft: 6, color: '#60a5fa' }}>{hover.segLabel}</span>}
                </div>
                <div style={tipRow}>
                  <span style={{ color: '#9ca3af' }}>Faktisk</span>
                  <span style={{ color: '#fb923c', fontWeight: 600 }}>{hover.point.actual_temp.toFixed(1)}°C</span>
                </div>
                <div style={tipRow}>
                  <span style={{ color: '#9ca3af' }}>Mål</span>
                  <span style={{ color: '#60a5fa', fontWeight: 600 }}>{hover.targetTemp.toFixed(1)}°C</span>
                </div>
                <div style={{ ...tipRow, borderTop: '0.5px solid rgba(255,255,255,.1)', paddingTop: 6, marginTop: 4 }}>
                  <span style={{ color: '#9ca3af' }}>Avvikelse</span>
                  <span style={{ color: diffColor, fontWeight: 700 }}>{diffStr}</span>
                </div>
                {hover.point.duty_cycle != null && (
                  <div style={tipRow}>
                    <span style={{ color: '#9ca3af' }}>Drift</span>
                    <span style={{ color: '#d1d5db' }}>{hover.point.duty_cycle.toFixed(1)}%</span>
                  </div>
                )}
                {hover.point.event && (
                  <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 4 }}>
                    ⚡ {hover.point.event}
                  </div>
                )}
              </div>
            </>
          )
        })()}
      </div>
      {dragBox && dragBox.width > 2 && (
        <div style={{
          position: 'absolute', top: 0, bottom: 0,
          left: dragBox.left, width: dragBox.width,
          background: 'rgba(30,111,191,.12)',
          border: '1px solid rgba(30,111,191,.35)',
          pointerEvents: 'none',
        }} />
      )}
    </div>
  )
}
