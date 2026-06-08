import { useLang } from '../i18n/index.jsx'
import React, { useState, useEffect, useRef } from 'react'


// Persist pin preference in localStorage
const STORAGE_KEY = 'kiln-sidebar-pinned'

export default function Sidebar({ active, onNavigate }) {
  const { t } = useLang()

  const NAV_ITEMS = [
    {
      id: 'kilns',
      label: t('nav_kilns'),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
          <path d="M12 6v6l4 2"/>
        </svg>
      ),
    },
    {
      id: 'templates',
      label: t('nav_templates'),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M3 9h18M9 21V9"/>
        </svg>
      ),
    },
    {
      id: 'burns',
      label: t('nav_burns'),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2c0 6-6 8-6 14a6 6 0 0 0 12 0c0-6-6-8-6-14z"/>
          <path d="M12 12c0 3-2 4-2 6a2 2 0 0 0 4 0c0-2-2-3-2-6z"/>
        </svg>
      ),
    },
    {
      id: 'elements',
      label: t('nav_elements'),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
        </svg>
      ),
    },
    {
      id: 'recipes',
      label: t('nav_recipes'),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18"/>
        </svg>
      ),
    },
    {
      id: 'photos',
      label: t('nav_photos'),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <path d="M21 15l-5-5L5 21"/>
        </svg>
      ),
    },
    {
      id: 'items',
      label: t('nav_items'),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2C8 2 4 6 4 10c0 6 8 12 8 12s8-6 8-12c0-4-4-8-8-8z"/>
          <circle cx="12" cy="10" r="2.5"/>
        </svg>
      ),
    },
    {
      id: 'settings',
      label: t('nav_settings'),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      ),
    },
  ]
  const [pinned,   setPinned]   = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) !== 'false' }
    catch { return true }
  })
  const [hovered,  setHovered]  = useState(false)
  const hoverTimer = useRef(null)

  // Expanded = pinned open, OR temporarily hovered open
  const expanded = pinned || hovered

  function togglePin() {
    const next = !pinned
    setPinned(next)
    try { localStorage.setItem(STORAGE_KEY, String(next)) } catch {}
    if (next) setHovered(false) // don't need hover state when pinned
  }

  function handleMouseEnter() {
    if (pinned) return
    clearTimeout(hoverTimer.current)
    setHovered(true)
  }

  function handleMouseLeave() {
    if (pinned) return
    // Small delay so accidental brush-outs don't instantly collapse
    hoverTimer.current = setTimeout(() => setHovered(false), 200)
  }

  useEffect(() => () => clearTimeout(hoverTimer.current), [])

  const width = expanded ? 220 : 56

  return (
    <aside
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        ...styles.sidebar,
        width,
        minWidth: width,
        transition: 'width .2s cubic-bezier(.4,0,.2,1), min-width .2s cubic-bezier(.4,0,.2,1)',
      }}
    >
      {/* Logo / collapse button */}
      <div style={{
        ...styles.logo,
        padding: expanded ? '18px 14px 16px' : '18px 0 16px',
        justifyContent: expanded ? 'flex-start' : 'center',
        gap: expanded ? 10 : 0,
        overflow: 'hidden',
      }}>
        {/* Logo icon — doubles as collapse toggle */}
        <button
          onClick={togglePin}
          title={pinned ? 'Collapse sidebar' : expanded ? 'Pin sidebar open' : 'Expand sidebar'}
          style={styles.logoIconBtn}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2c0 6-6 8-6 14a6 6 0 0 0 12 0c0-6-6-8-6-14z"/>
          </svg>
        </button>

        {/* Text + pin button — only visible when expanded */}
        {expanded && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1, minWidth: 0 }}>
            <div style={{ overflow: 'hidden' }}>
              <div style={styles.logoText}>KilnOS</div>
              <div style={styles.logoSub}>Controller</div>
            </div>

            {/* Pin button */}
            <button
              onClick={togglePin}
              title={pinned ? 'Unpin (collapse on mouse leave)' : 'Pin open'}
              style={{
                ...styles.pinBtn,
                color: pinned ? '#fff' : 'rgba(255,255,255,.35)',
              }}
            >
              <PinIcon pinned={pinned} />
            </button>
          </div>
        )}
      </div>

      <div style={styles.divider} />

      {/* Nav label */}
      {expanded && (
        <div style={styles.navLabel}>MAIN MENU</div>
      )}

      {/* Nav items */}
      <nav style={{ ...styles.nav, padding: expanded ? '0 8px' : '0 6px' }}>
        {NAV_ITEMS.map(item => {
          const isActive = active === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              title={expanded ? undefined : item.label}
              style={{
                ...styles.navItem,
                justifyContent: expanded ? 'flex-start' : 'center',
                padding: expanded ? '9px 10px' : '9px 0',
                ...(isActive ? styles.navItemActive : {}),
              }}
            >
              <span style={{
                ...styles.navIcon,
                color: isActive ? '#fff' : 'rgba(255,255,255,.45)',
              }}>
                {item.icon}
              </span>

              {expanded && (
                <span style={{
                  color: isActive ? '#fff' : 'rgba(255,255,255,.6)',
                  fontWeight: isActive ? 500 : 400,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                }}>
                  {item.label}
                </span>
              )}

              {isActive && expanded && <div style={styles.activeIndicator} />}
              {isActive && !expanded && <div style={styles.activeIndicatorCollapsed} />}
            </button>
          )
        })}
      </nav>

      {/* Bottom */}
      <div style={styles.bottom}>
        <div style={styles.divider} />
        {expanded && <div style={styles.version}>v1.0.0</div>}
      </div>
    </aside>
  )
}

function PinIcon({ pinned }) {
  return pinned ? (
    // Filled pin = pinned
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M16 12V4h1a1 1 0 0 0 0-2H7a1 1 0 0 0 0 2h1v8l-2 2v2h5v6l1 1 1-1v-6h5v-2l-2-2z"/>
    </svg>
  ) : (
    // Outline pin = unpinned
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 12V4h1a1 1 0 0 0 0-2H7a1 1 0 0 0 0 2h1v8l-2 2v2h5v6l1 1 1-1v-6h5v-2l-2-2z"/>
    </svg>
  )
}

const styles = {
  sidebar: {
    background: '#0f1923',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    position: 'sticky',
    top: 0,
    flexShrink: 0,
    overflow: 'hidden',
    zIndex: 50,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
  },
  logoIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    background: '#1e6fbf',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    border: 'none',
    cursor: 'pointer',
    transition: 'background .15s',
  },
  logoText: {
    color: '#fff',
    fontWeight: 600,
    fontSize: 14,
    letterSpacing: '.3px',
    lineHeight: 1.2,
  },
  logoSub: {
    color: 'rgba(255,255,255,.4)',
    fontSize: 10,
    letterSpacing: '.5px',
    textTransform: 'uppercase',
  },
  pinBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    transition: 'color .15s',
    flexShrink: 0,
  },
  divider: {
    height: 1,
    background: 'rgba(255,255,255,.07)',
    margin: '0 10px',
    flexShrink: 0,
  },
  navLabel: {
    color: 'rgba(255,255,255,.3)',
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: '1.2px',
    textTransform: 'uppercase',
    padding: '14px 18px 6px',
    whiteSpace: 'nowrap',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    borderRadius: 7,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
    fontSize: 13,
    fontFamily: 'var(--font)',
    transition: 'background .12s',
    position: 'relative',
    overflow: 'hidden',
  },
  navItemActive: {
    background: '#1e6fbf',
  },
  navIcon: {
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  activeIndicator: {
    position: 'absolute',
    right: 0,
    top: '50%',
    transform: 'translateY(-50%)',
    width: 3,
    height: 18,
    borderRadius: '3px 0 0 3px',
    background: '#fff',
    opacity: .6,
  },
  activeIndicatorCollapsed: {
    position: 'absolute',
    left: 0,
    top: '50%',
    transform: 'translateY(-50%)',
    width: 3,
    height: 18,
    borderRadius: '0 3px 3px 0',
    background: '#fff',
    opacity: .6,
  },
  bottom: {
    marginTop: 'auto',
    paddingBottom: 14,
  },
  version: {
    color: 'rgba(255,255,255,.25)',
    fontSize: 10,
    padding: '10px 18px 0',
    whiteSpace: 'nowrap',
  },
}
