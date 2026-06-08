import React, { useEffect, useState } from 'react'
import { useLang } from '../i18n/index.jsx'
import { photosApi } from '../lib/api'
import { Button, PageHeader } from '../components/UI'
import PhotoUploadModal from '../components/PhotoUploadModal'

export default function PhotosPage({ toast }) {
  const { t } = useLang()
  const [photos, setPhotos]       = useState([])
  const [tags, setTags]           = useState([])
  const [burns, setBurns]         = useState([])   // burns that have photos
  const [activeTag, setActiveTag] = useState(null)
  const [activeBurn, setActiveBurn] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [lightbox, setLightbox]   = useState(null)
  const [editing, setEditing]     = useState(null)  // photo being edited

  async function load() {
    setLoading(true)
    try {
      const params = {}
      if (activeTag)  params.tag     = activeTag
      if (activeBurn) params.burn_id = activeBurn
      const [p, t, b] = await Promise.all([
        photosApi.list(params),
        photosApi.tags(),
        photosApi.burns(),
      ])
      setPhotos(p)
      setTags(t)
      setBurns(b)
    } catch (e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [activeTag, activeBurn])

  async function handleDelete(id) {
    if (!confirm('Ta bort detta foto?')) return
    try {
      await photosApi.delete(id)
      toast(t('photo_deleted'))
      if (lightbox?.id === id) setLightbox(null)
      load()
    } catch (e) { toast(e.message, 'error') }
  }

  async function handleSaveEdit(id, data) {
    try {
      const updated = await photosApi.update(id, data)
      toast(t('photo_updated'))
      setEditing(null)
      if (lightbox?.id === id) setLightbox(updated)
      load()
    } catch (e) { toast(e.message, 'error') }
  }

  return (
    <div>
      <PageHeader
        title="Photo Album"
        subtitle="All photos across burns and recipes"
        action={<Button variant="primary" onClick={() => setUploadOpen(true)}>+ Upload Photo</Button>}
      />

      {/* Filters */}
      <div style={styles.filterSection}>
        {/* Tag filter */}
        <div style={styles.filterGroup}>
          <span style={styles.filterLabel}>Tag</span>
          <div style={styles.chipRow}>
            <Chip active={activeTag === null} onClick={() => setActiveTag(null)}>All</Chip>
            {tags.map(t => (
              <Chip key={t} active={activeTag === t} onClick={() => setActiveTag(activeTag === t ? null : t)}>
                {t}
              </Chip>
            ))}
          </div>
        </div>

        {/* Burn filter */}
        {burns.length > 0 && (
          <div style={styles.filterGroup}>
            <span style={styles.filterLabel}>Burn</span>
            <div style={styles.chipRow}>
              <Chip active={activeBurn === null} onClick={() => setActiveBurn(null)}>All</Chip>
              {burns.map(b => (
                <Chip key={b.id} active={activeBurn === b.id} onClick={() => setActiveBurn(activeBurn === b.id ? null : b.id)}>
                  {b.name}
                </Chip>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>Loading…</div>
      ) : photos.length === 0 ? (
        <div style={styles.empty}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: .4 }}>📷</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 6 }}>
            {activeTag || activeBurn ? t('photos_empty_filtered') : t('photos_empty_title')}
          </div>
          {(activeTag || activeBurn) ? (
            <Button variant="ghost" onClick={() => { setActiveTag(null); setActiveBurn(null) }}>
              Clear filters
            </Button>
          ) : (
            <Button variant="primary" onClick={() => setUploadOpen(true)}>+ Upload Photo</Button>
          )}
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 14 }}>
            {photos.length} photo{photos.length !== 1 ? 's' : ''}
          </div>
          <div style={styles.grid}>
            {photos.map(p => (
              <PhotoCard
                key={p.id}
                photo={p}
                activeTag={activeTag}
                onTagClick={t => setActiveTag(t === activeTag ? null : t)}
                onClick={() => setLightbox(p)}
              />
            ))}
          </div>
        </>
      )}

      {/* Upload modal */}
      <PhotoUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => { setUploadOpen(false); load() }}
        toast={toast}
        existingTags={tags}
      />

      {/* Lightbox */}
      {lightbox && (
        <Lightbox
          photo={lightbox}
          onClose={() => setLightbox(null)}
          onEdit={() => { setEditing(lightbox); setLightbox(null) }}
          onDelete={() => handleDelete(lightbox.id)}
          onTagClick={t => { setLightbox(null); setActiveTag(t) }}
        />
      )}

      {/* Edit modal */}
      {editing && (
        <EditModal
          photo={editing}
          existingTags={tags}
          onClose={() => setEditing(null)}
          onSave={(data) => handleSaveEdit(editing.id, data)}
        />
      )}
    </div>
  )
}

// ── Photo card ────────────────────────────────────────────
function PhotoCard({ photo, activeTag, onTagClick, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      style={{ ...styles.card, boxShadow: hovered ? 'var(--shadow)' : 'var(--shadow-sm)', transform: hovered ? 'translateY(-2px)' : 'none' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      <div style={styles.imgWrap}>
        <img src={photo.url} alt={photo.title || photo.original} style={styles.img} />
      </div>
      <div style={styles.cardBody}>
        {photo.title && <div style={styles.cardTitle}>{photo.title}</div>}
        {photo.burn_name && (
          <div style={styles.burnLabel}>🔥 {photo.burn_name}</div>
        )}
        {photo.tags && (
          <div style={styles.tagRow}>
            {photo.tags.split(',').filter(Boolean).map(t => (
              <button
                key={t}
                style={{ ...styles.tagChip, background: activeTag === t ? '#dbeafe' : 'var(--color-background-secondary)', color: activeTag === t ? '#1e40af' : 'var(--color-text-secondary)' }}
                onClick={e => { e.stopPropagation(); onTagClick(t) }}
              >
                {t}
              </button>
            ))}
          </div>
        )}
        <div style={styles.date}>{new Date(photo.created_at).toLocaleDateString('sv-SE')}</div>
      </div>
    </div>
  )
}

// ── Lightbox ──────────────────────────────────────────────
function Lightbox({ photo, onClose, onEdit, onDelete, onTagClick }) {
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.lightboxBox} onClick={e => e.stopPropagation()}>
        {/* Image */}
        <div style={{ background: '#000', borderRadius: 'var(--border-radius-lg) var(--border-radius-lg) 0 0', overflow: 'hidden' }}>
          <img src={photo.url} alt={photo.title} style={styles.lightboxImg} />
        </div>

        {/* Info — explicitly light background so text is always readable */}
        <div style={styles.lightboxInfo}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {photo.title && (
                <div style={{ fontSize: 17, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
                  {photo.title}
                </div>
              )}
              {photo.notes && (
                <div style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.6, marginBottom: 8 }}>
                  {photo.notes}
                </div>
              )}
              {/* Context */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {photo.burn_name && (
                  <span style={styles.contextBadge}>🔥 {photo.burn_name}</span>
                )}
                {photo.recipe_id && (
                  <span style={styles.contextBadge}>⚗️ Recipe #{photo.recipe_id}</span>
                )}
              </div>
              {/* Tags — clickable */}
              {photo.tags && (
                <div style={styles.tagRow}>
                  {photo.tags.split(',').filter(Boolean).map(t => (
                    <button
                      key={t}
                      style={{ ...styles.tagChip, cursor: 'pointer' }}
                      onClick={() => onTagClick(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>
                {new Date(photo.created_at).toLocaleString('sv-SE').replace('T', ' ').slice(0, 16)}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, marginLeft: 16, flexShrink: 0 }}>
              <button style={styles.actionBtn} onClick={onEdit}>✏️ Edit</button>
              <button style={{ ...styles.actionBtn, color: '#dc2626', borderColor: '#fca5a5', background: '#fee2e2' }} onClick={onDelete}>Delete</button>
              <button style={styles.actionBtn} onClick={onClose}>Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Edit modal ────────────────────────────────────────────
function EditModal({ photo, existingTags, onClose, onSave }) {
  const [title, setTitle]     = useState(photo.title || '')
  const [notes, setNotes]     = useState(photo.notes || '')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags]       = useState(
    photo.tags ? photo.tags.split(',').filter(Boolean) : []
  )
  const [saving, setSaving]   = useState(false)

  function addTag(t) {
    const clean = t.trim().toLowerCase()
    if (clean && !tags.includes(clean)) setTags(prev => [...prev, clean])
    setTagInput('')
  }

  async function handleSave() {
    setSaving(true)
    await onSave({ title, notes, tags: tags.join(',') })
    setSaving(false)
  }

  const suggTags = existingTags.filter(t =>
    tagInput && t.includes(tagInput.toLowerCase()) && !tags.includes(t)
  ).slice(0, 6)

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={{ ...styles.lightboxBox, maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>Edit Photo</div>
        </div>
        <div style={{ padding: 20, background: '#fff', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={styles.editLabel}>Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} style={styles.editInput} placeholder="Photo title" />
          </div>
          <div>
            <label style={styles.editLabel}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} style={{ ...styles.editInput, minHeight: 72, resize: 'vertical' }} placeholder="Notes…" />
          </div>
          <div>
            <label style={styles.editLabel}>Tags</label>
            {tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
                {tags.map(t => (
                  <span key={t} style={{ ...styles.tagChipEdit }}>
                    {t}
                    <button onClick={() => setTags(prev => prev.filter(x => x !== t))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1e40af', fontSize: 14, padding: '0 0 0 3px', lineHeight: 1 }}>×</button>
                  </span>
                ))}
              </div>
            )}
            <input
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput) }
                if (e.key === 'Backspace' && !tagInput && tags.length) setTags(prev => prev.slice(0, -1))
              }}
              style={styles.editInput}
              placeholder="Add tag, press Enter…"
            />
            {suggTags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                {suggTags.map(t => (
                  <button key={t} onClick={() => addTag(t)}
                    style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, background: '#f3f4f6', border: '1px solid #e5e7eb', cursor: 'pointer', fontFamily: 'inherit', color: '#4b5563' }}>
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ padding: '12px 20px', background: '#f9fafb', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 8, borderRadius: '0 0 12px 12px' }}>
          <button style={{ ...styles.actionBtn }} onClick={onClose}>Cancel</button>
          <button style={{ ...styles.actionBtn, background: '#1e6fbf', color: '#fff', borderColor: '#1e6fbf' }} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : t('save')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Chip component ────────────────────────────────────────
function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: active ? 500 : 400,
        border: `0.5px solid ${active ? '#93c5fd' : 'var(--color-border-secondary)'}`,
        background: active ? '#dbeafe' : 'var(--color-background-primary)',
        color: active ? '#1e40af' : 'var(--color-text-secondary)',
        cursor: 'pointer', fontFamily: 'inherit', transition: 'all .12s',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

const styles = {
  filterSection: { display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 },
  filterGroup:   { display: 'flex', alignItems: 'flex-start', gap: 10 },
  filterLabel:   { fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--color-text-secondary)', paddingTop: 6, whiteSpace: 'nowrap', minWidth: 36 },
  chipRow:       { display: 'flex', flexWrap: 'wrap', gap: 5 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
    gap: 14,
  },
  card: {
    background: 'var(--color-background-primary)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 'var(--border-radius-lg)',
    overflow: 'hidden', cursor: 'pointer',
    transition: 'box-shadow .12s, transform .12s',
  },
  imgWrap: { overflow: 'hidden' },
  img: { width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' },
  cardBody: { padding: '8px 10px 10px' },
  cardTitle: { fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  burnLabel: { fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4 },
  tagRow: { display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 4 },
  tagChip: { fontSize: 10, padding: '2px 6px', borderRadius: 99, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, transition: 'all .1s' },
  tagChipEdit: { display: 'inline-flex', alignItems: 'center', fontSize: 12, padding: '2px 8px', borderRadius: 99, background: '#dbeafe', color: '#1e40af', fontWeight: 500 },
  date: { fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 2 },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 24px', textAlign: 'center' },
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', backdropFilter: 'blur(4px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
  lightboxBox: { background: '#ffffff', borderRadius: 12, overflow: 'hidden', maxWidth: 720, width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,.5)' },
  lightboxImg: { width: '100%', maxHeight: 480, objectFit: 'contain', display: 'block' },
  lightboxInfo: { padding: '16px 20px', background: '#ffffff' },
  contextBadge: { fontSize: 11, padding: '2px 8px', borderRadius: 99, background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#4b5563' },
  actionBtn: { padding: '6px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', color: '#374151', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 500 },
  editLabel: { display: 'block', fontSize: 11, fontWeight: 500, color: '#4b5563', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.5px' },
  editInput: { width: '100%', padding: '8px 10px', fontSize: 13, background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, color: '#111827', fontFamily: 'inherit', outline: 'none' },
}
