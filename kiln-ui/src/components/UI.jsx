import React from 'react'

// ── Badge ─────────────────────────────────────────────────
const BADGE_STYLES = {
  pending:   { background: '#f3f4f6', color: '#6b7280' },
  running:   { background: '#fef3c7', color: '#d97706' },
  completed: { background: '#d1fae5', color: '#059669' },
  aborted:   { background: '#fee2e2', color: '#dc2626' },
}

export function Badge({ status }) {
  const s = BADGE_STYLES[status] || BADGE_STYLES.pending
  return (
    <span style={{
      ...s,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '3px 10px',
      borderRadius: 99,
      fontSize: 12,
      fontWeight: 500,
      letterSpacing: '.1px',
      textTransform: 'capitalize',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: s.color,
        opacity: .8,
      }} />
      {status}
    </span>
  )
}

// ── Button ────────────────────────────────────────────────
const BTN_VARIANTS = {
  primary: {
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    hover: { background: 'var(--accent-hover)' },
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-2)',
    border: '1px solid var(--border-2)',
    hover: { background: 'var(--surface-alt)', borderColor: 'var(--border-2)' },
  },
  danger: {
    background: 'var(--danger-bg)',
    color: 'var(--danger)',
    border: '1px solid #fca5a5',
    hover: { background: '#fecaca' },
  },
  success: {
    background: 'var(--success-bg)',
    color: 'var(--success)',
    border: '1px solid #6ee7b7',
    hover: { background: '#a7f3d0' },
  },
}

export function Button({ children, variant = 'ghost', size = 'md', onClick, disabled, style }) {
  const v = BTN_VARIANTS[variant] || BTN_VARIANTS.ghost
  const sz = size === 'sm'
    ? { padding: '5px 12px', fontSize: 12 }
    : { padding: '8px 16px', fontSize: 13 }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...v,
        ...sz,
        borderRadius: 'var(--r)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? .5 : 1,
        fontFamily: 'var(--font)',
        fontWeight: 500,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        transition: 'all .15s',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </button>
  )
}

// ── EmptyState ────────────────────────────────────────────
export function EmptyState({ icon, title, description, action }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '80px 24px', textAlign: 'center',
      color: 'var(--text-3)',
      gridColumn: '1 / -1',
    }}>
      <div style={{ fontSize: 40, marginBottom: 16, opacity: .5 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, maxWidth: 300, lineHeight: 1.6, marginBottom: action ? 20 : 0 }}>{description}</div>
      {action}
    </div>
  )
}

// ── Toast ─────────────────────────────────────────────────
const TOAST_STYLES = {
  success: { border: '1px solid #6ee7b7', background: '#f0fdf4', color: '#065f46' },
  error:   { border: '1px solid #fca5a5', background: '#fff5f5', color: '#991b1b' },
  info:    { border: '1px solid #93c5fd', background: '#eff6ff', color: '#1e40af' },
}

export function Toast({ toast }) {
  if (!toast) return null
  const s = TOAST_STYLES[toast.type] || TOAST_STYLES.info
  return (
    <div style={{
      position: 'fixed',
      bottom: 28, right: 28,
      zIndex: 2000,
      ...s,
      padding: '12px 18px',
      borderRadius: 'var(--r-lg)',
      fontSize: 13,
      fontWeight: 500,
      boxShadow: 'var(--shadow)',
      maxWidth: 340,
      animation: 'slideUp .2s ease',
    }}>
      {toast.message}
    </div>
  )
}

// ── FormField ─────────────────────────────────────────────
export function FormField({ label, hint, children, span }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 5,
      gridColumn: span ? `span ${span}` : undefined,
    }}>
      {label && (
        <label style={{
          fontSize: 12, fontWeight: 500,
          color: 'var(--text-2)', letterSpacing: '.1px',
        }}>
          {label}
        </label>
      )}
      {children}
      {hint && <span style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.4 }}>{hint}</span>}
    </div>
  )
}

// ── Input / Select / Textarea ─────────────────────────────
const inputBase = {
  background: 'var(--surface)',
  border: '1px solid var(--border-2)',
  borderRadius: 'var(--r)',
  padding: '8px 12px',
  color: 'var(--text)',
  fontFamily: 'var(--font)',
  fontSize: 13,
  width: '100%',
  transition: 'border-color .15s, box-shadow .15s',
  outline: 'none',
}

export function Input({ style, ...props }) {
  return <input style={{ ...inputBase, ...style }} {...props} />
}

export function Select({ children, style, ...props }) {
  return (
    <select style={{ ...inputBase, ...style }} {...props}>
      {children}
    </select>
  )
}

export function Textarea({ style, ...props }) {
  return <textarea style={{ ...inputBase, minHeight: 80, resize: 'vertical', ...style }} {...props} />
}

// ── Section divider ───────────────────────────────────────
export function SectionDivider({ children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      gridColumn: '1 / -1',
      margin: '8px 0 4px',
    }}>
      <span style={{
        fontSize: 11, fontWeight: 600, color: 'var(--text-3)',
        textTransform: 'uppercase', letterSpacing: '1px', whiteSpace: 'nowrap',
      }}>{children}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  )
}

// ── Page header ───────────────────────────────────────────
export function PageHeader({ title, subtitle, action }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start',
      justifyContent: 'space-between', marginBottom: 24,
    }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', letterSpacing: '-.3px', lineHeight: 1.2 }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 3 }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

// ── Card ──────────────────────────────────────────────────
export const Card = React.forwardRef(function Card({ children, onClick, style }, ref) {
  return (
    <div
      ref={ref}
      onClick={onClick}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)',
        padding: '20px',
        boxShadow: 'var(--shadow-sm)',
        cursor: onClick ? 'pointer' : undefined,
        transition: onClick ? 'box-shadow .15s, border-color .15s, transform .1s' : undefined,
        ...style,
      }}
      onMouseEnter={onClick ? (e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow)'
        e.currentTarget.style.borderColor = '#93c5fd'
        e.currentTarget.style.transform = 'translateY(-1px)'
      } : undefined}
      onMouseLeave={onClick ? (e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.transform = 'translateY(0)'
      } : undefined}
    >
      {children}
    </div>
  )
})

// ── Inject keyframe ───────────────────────────────────────
const style = document.createElement('style')
style.textContent = `@keyframes slideUp { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }`
document.head.appendChild(style)
