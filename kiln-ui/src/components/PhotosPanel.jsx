import React, { useState } from 'react'
import { useLang } from '../i18n/index.jsx'
import { photosApi } from '../lib/api'
import { Button, Card } from '../components/UI'
import PhotoUploadModal from './PhotoUploadModal'

/**
 * PhotosPanel — embeddable photo grid for a burn or recipe.
 * Props:
 *   photos      — PhotoOut[] already loaded by parent
 *   burnId      — optional, pre-fills upload link
 *   recipeId    — optional, pre-fills upload link
 *   existingTags — string[] for tag suggestions
 *   onRefresh   — reload callback
 *   toast       — fn
 */
export default function PhotosPanel({ photos = [], burnId, recipeId, existingTags = [], onRefresh, toast }) {
  const { t } = useLang()
  const [uploadOpen, setUploadOpen] = useState(false)
  const [lightbox, setLightbox]     = useState(null)  // photo being viewed full-size

  async function handleDelete(id) {
    if (!confirm('Ta bort detta foto?')) return
    try { await photosApi.delete(id); toast(t('photo_deleted')); onRefresh() }
    catch (e) { toast(e.message, 'error') }
  }

  return (
    <>
      <Card style={{ marginBottom: 20 }}>
        <div style={styles.header}>
          <div style={styles.sectionLabel}>Photos</div>
          <Button size="sm" variant="primary" onClick={() => setUploadOpen(true)}>+ Add Photo</Button>
        </div>

        {photos.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
            No photos yet.
          </div>
        ) : (
          <div style={styles.grid}>
            {photos.map(p => (
              <div key={p.id} style={styles.thumb} onClick={() => setLightbox(p)}>
                <img src={p.url} alt={p.title || p.original} style={styles.img} />
                {/* Tags */}
                {p.tags && (
                  <div style={styles.tagRow}>
                    {p.tags.split(',').filter(Boolean).map(t => (
                      <span key={t} style={styles.tag}>{t}</span>
                    ))}
                  </div>
                )}
                {p.title && <div style={styles.thumbTitle}>{p.title}</div>}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Upload modal */}
      <PhotoUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => { setUploadOpen(false); onRefresh() }}
        toast={toast}
        defaultBurnId={burnId}
        defaultRecipeId={recipeId}
        existingTags={existingTags}
      />

      {/* Lightbox */}
      {lightbox && (
        <div style={styles.lightboxBackdrop} onClick={() => setLightbox(null)}>
          <div style={styles.lightboxBox} onClick={e => e.stopPropagation()}>
            <img src={lightbox.url} alt={lightbox.title} style={styles.lightboxImg} />
            <div style={styles.lightboxInfo}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  {lightbox.title && <div style={styles.lightboxTitle}>{lightbox.title}</div>}
                  {lightbox.notes && <div style={styles.lightboxNotes}>{lightbox.notes}</div>}
                  {lightbox.tags && (
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
                      {lightbox.tags.split(',').filter(Boolean).map(t => (
                        <span key={t} style={styles.tag}>{t}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button size="sm" variant="danger" onClick={() => { handleDelete(lightbox.id); setLightbox(null) }}>
                    Delete
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setLightbox(null)}>Close</Button>
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 8 }}>
                {new Date(lightbox.created_at).toLocaleString('sv-SE').replace('T', ' ').slice(0, 16)}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const styles = {
  header: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 11, fontWeight: 500, textTransform: 'uppercase',
    letterSpacing: '1px', color: 'var(--color-text-secondary)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: 10,
  },
  thumb: {
    borderRadius: 'var(--border-radius-md)',
    overflow: 'hidden',
    background: 'var(--color-background-secondary)',
    border: '0.5px solid var(--color-border-tertiary)',
    cursor: 'pointer',
    transition: 'transform .12s, box-shadow .12s',
  },
  img: {
    width: '100%', aspectRatio: '1',
    objectFit: 'cover', display: 'block',
  },
  tagRow: {
    display: 'flex', flexWrap: 'wrap', gap: 3, padding: '5px 6px 2px',
  },
  tag: {
    fontSize: 10, padding: '1px 6px', borderRadius: 99,
    background: '#dbeafe', color: '#1e40af', fontWeight: 500,
  },
  thumbTitle: {
    fontSize: 11, padding: '2px 6px 6px',
    color: 'var(--color-text-secondary)',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  lightboxBackdrop: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,.75)',
    backdropFilter: 'blur(4px)',
    zIndex: 2000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 24,
  },
  lightboxBox: {
    background: 'var(--color-background-primary)',
    borderRadius: 'var(--border-radius-xl)',
    overflow: 'hidden',
    maxWidth: 700, width: '100%',
    boxShadow: '0 24px 64px rgba(0,0,0,.4)',
  },
  lightboxImg: {
    width: '100%', maxHeight: 480,
    objectFit: 'contain', display: 'block',
    background: '#000',
  },
  lightboxInfo: {
    padding: '16px 20px',
  },
  lightboxTitle: {
    fontSize: 16, fontWeight: 500,
    color: 'var(--color-text-primary)', marginBottom: 4,
  },
  lightboxNotes: {
    fontSize: 13, color: 'var(--color-text-secondary)',
    lineHeight: 1.5,
  },
}
