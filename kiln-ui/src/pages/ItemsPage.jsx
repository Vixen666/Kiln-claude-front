import React, { useEffect, useState } from 'react'
import { itemsApi, photosApi } from '../lib/api'
import { useLang } from '../i18n/index.jsx'
import { Button, EmptyState, PageHeader, Card } from '../components/UI'
import ItemModal from './ItemModal'
import PhotoUploadModal from '../components/PhotoUploadModal'

const STATUSES = [
  { value: 'all',        label: 'Alla',             bg: null },
  { value: 'studio',     label: 'I studio',         bg: '#f3f4f6', color: '#374151' },
  { value: 'for_sale',   label: 'Till salu',        bg: '#d1fae5', color: '#065f46' },
  { value: 'sold',       label: 'Såld',             bg: '#fee2e2', color: '#991b1b' },
  { value: 'gifted',     label: 'Bortgiven',        bg: '#ede9fe', color: '#5b21b6' },
  { value: 'exhibition', label: 'På utställning',   bg: '#fef3c7', color: '#92400e' },
]

function StatusBadge({ status }) {
  const s = STATUSES.find(x => x.value === status) || STATUSES[1]
  return (
    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99,
      background: s.bg, color: s.color, fontWeight: 500 }}>
      {s.label}
    </span>
  )
}

export default function ItemsPage({ toast }) {
  const { t } = useLang()
  const [items, setItems]         = useState([])
  const [tags, setTags]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState(null)
  const [editing, setEditing]     = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [expanded, setExpanded]   = useState(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadItemId, setUploadItemId] = useState(null)
  const [confirmId, setConfirmId] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const params = {}
      if (statusFilter !== 'all') params.status = statusFilter
      if (tagFilter) params.tag = tagFilter
      const [its, tgs] = await Promise.all([itemsApi.list(params), itemsApi.tags()])
      setItems(its)
      setTags(tgs)
    } catch (e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [statusFilter, tagFilter])

  async function handleSave(data) {
    try {
      if (editing?.id) await itemsApi.update(editing.id, data)
      else await itemsApi.create(data)
      toast('Objekt sparat')
      setModalOpen(false)
      load()
    } catch (e) { toast(e.message, 'error') }
  }

  async function handleDelete(id) {
    try {
      await itemsApi.delete(id)
      toast('Objekt borttaget')
      setConfirmId(null)
      if (expanded === id) setExpanded(null)
      load()
    } catch (e) { toast(e.message, 'error') }
  }

  async function handlePhotoUploaded() {
    setUploadOpen(false)
    load()
  }

  const expandedItem = items.find(i => i.id === expanded)

  return (
    <div>
      <PageHeader
        title="Objekt"
        subtitle="Färdiga keramikobjekt — koppla till bränning, recept och foton"
        action={<Button variant="primary" onClick={() => { setEditing(null); setModalOpen(true) }}>+ Nytt objekt</Button>}
      />

      {/* Status filter */}
      <div style={styles.filterRow}>
        {STATUSES.map(s => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(s.value)}
            style={{
              ...styles.filterBtn,
              background: statusFilter === s.value ? (s.bg || '#dbeafe') : 'var(--color-background-primary)',
              color: statusFilter === s.value ? (s.color || '#1e40af') : 'var(--color-text-secondary)',
              border: `0.5px solid ${statusFilter === s.value ? 'transparent' : 'var(--color-border-secondary)'}`,
              fontWeight: statusFilter === s.value ? 600 : 400,
            }}
          >
            {s.label}
            {statusFilter === s.value && items.length > 0 && (
              <span style={styles.countBadge}>{items.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tag filter */}
      {tags.length > 0 && (
        <div style={styles.tagRow}>
          <span style={styles.filterLabel}>Taggar:</span>
          <button
            style={{ ...styles.tagBtn, ...(tagFilter === null ? styles.tagBtnActive : {}) }}
            onClick={() => setTagFilter(null)}
          >Alla</button>
          {tags.map(tg => (
            <button
              key={tg}
              style={{ ...styles.tagBtn, ...(tagFilter === tg ? styles.tagBtnActive : {}) }}
              onClick={() => setTagFilter(tagFilter === tg ? null : tg)}
            >
              {tg}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>{t('loading')}</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon="🏺"
          title={statusFilter !== 'all' || tagFilter ? 'Inga objekt matchar filtret' : 'Inga objekt ännu'}
          description={statusFilter !== 'all' || tagFilter ? '' : 'Skapa ditt första objekt för att börja spåra dina keramikskapelser.'}
          action={(!statusFilter || statusFilter === 'all') && !tagFilter &&
            <Button variant="primary" onClick={() => { setEditing(null); setModalOpen(true) }}>+ Nytt objekt</Button>}
        />
      ) : (
        <>
          {/* Expanded item */}
          {expandedItem && (
            <ExpandedItem
              item={expandedItem}
              onEdit={() => { setEditing(expandedItem); setModalOpen(true) }}
              onDelete={() => handleDelete(expandedItem.id)}
              onClose={() => setExpanded(null)}
              onAddPhoto={() => { setUploadItemId(expandedItem.id); setUploadOpen(true) }}
              onTagClick={tg => setTagFilter(tg === tagFilter ? null : tg)}
            />
          )}

          <div style={styles.grid}>
            {items.map(item => {
              const isExpanded = item.id === expanded
              const coverPhoto = item.photos?.[0]
              return (
                <Card key={item.id} style={isExpanded ? { opacity: 0.4, pointerEvents: 'none' } : {}}>
                  {/* Cover photo */}
                  {coverPhoto ? (
                    <div style={styles.coverWrap} onClick={() => setExpanded(isExpanded ? null : item.id)}>
                      <img src={coverPhoto.url} alt={item.name} style={styles.coverImg} />
                      <div style={styles.photoCount}>
                        📷 {item.photos.length}
                      </div>
                    </div>
                  ) : (
                    <div style={styles.noCover} onClick={() => setExpanded(isExpanded ? null : item.id)}>
                      <span style={{ fontSize: 32 }}>🏺</span>
                    </div>
                  )}

                  <div style={{ padding: '10px 4px 4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <button
                        onClick={() => setExpanded(isExpanded ? null : item.id)}
                        style={styles.nameBtn}
                      >
                        {item.name}
                      </button>
                      <StatusBadge status={item.status} />
                    </div>

                    {item.price != null && (
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#059669', marginBottom: 4 }}>
                        {item.price} kr
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 6, fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 6, flexWrap: 'wrap' }}>
                      {item.burn_name && <span>🔥 {item.burn_name}</span>}
                      {item.recipe_name && <span>⚗️ {item.recipe_name}</span>}
                      {item.dimensions && <span>📐 {item.dimensions}</span>}
                    </div>

                    {item.tags && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 8 }}>
                        {item.tags.split(',').filter(Boolean).map(tg => (
                          <button key={tg} onClick={() => setTagFilter(tg === tagFilter ? null : tg)}
                            style={{ ...styles.tagChip, background: tagFilter === tg ? '#dbeafe' : '#f3f4f6', color: tagFilter === tg ? '#1e40af' : '#4b5563' }}>
                            {tg}
                          </button>
                        ))}
                      </div>
                    )}

                    {item.published && (
                      <div style={{ fontSize: 10, color: '#059669', fontWeight: 500 }}>✓ Publicerad</div>
                    )}

                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <Button size="sm" onClick={() => { setEditing(item); setModalOpen(true) }}>Redigera</Button>
                      {confirmId === item.id ? (
                        <>
                          <Button size="sm" variant="danger" onClick={() => handleDelete(item.id)}>Ja</Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>Nej</Button>
                        </>
                      ) : (
                        <Button size="sm" variant="danger" onClick={() => setConfirmId(item.id)}>Ta bort</Button>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </>
      )}

      <ItemModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        initial={editing}
      />

      <PhotoUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={handlePhotoUploaded}
        toast={toast}
        defaultItemId={uploadItemId}
        existingTags={tags}
      />
    </div>
  )
}

// ── Expanded item full-width view ─────────────────────────
function ExpandedItem({ item, onEdit, onDelete, onClose, onAddPhoto, onTagClick }) {
  return (
    <div style={styles.expandedCard}>
      <div style={styles.expandedHeader}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={styles.expandedName}>{item.name}</span>
            <StatusBadge status={item.status} />
            {item.published && <span style={styles.publishedBadge}>✓ Publicerad</span>}
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 6, flexWrap: 'wrap', fontSize: 13, color: 'var(--color-text-secondary)' }}>
            {item.price != null && <span style={{ color: '#059669', fontWeight: 700, fontSize: 16 }}>{item.price} kr</span>}
            {item.dimensions && <span>📐 {item.dimensions}</span>}
            {item.weight_g && <span>⚖️ {item.weight_g}g</span>}
            {item.burn_name && <span>🔥 {item.burn_name}</span>}
            {item.recipe_name && <span>⚗️ {item.recipe_name}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button size="sm" onClick={onAddPhoto}>+ Foto</Button>
          <Button size="sm" onClick={onEdit}>Redigera</Button>
          <Button size="sm" variant="danger" onClick={onDelete}>Ta bort</Button>
          <Button size="sm" variant="ghost" onClick={onClose}>✕ Stäng</Button>
        </div>
      </div>

      {/* Photos grid */}
      {item.photos?.length > 0 ? (
        <div style={styles.photoGrid}>
          {item.photos.map(p => (
            <div key={p.id} style={styles.photoThumb}>
              <img src={p.url} alt={p.title || ''} style={styles.photoImg} />
              {p.title && <div style={styles.photoTitle}>{p.title}</div>}
            </div>
          ))}
          <div style={styles.addPhotoBtn} onClick={onAddPhoto}>
            <span style={{ fontSize: 24 }}>+</span>
            <span style={{ fontSize: 11 }}>Lägg till foto</span>
          </div>
        </div>
      ) : (
        <div style={styles.noPhotos} onClick={onAddPhoto}>
          <span style={{ fontSize: 32 }}>📷</span>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Inga foton ännu — klicka för att lägga till</div>
        </div>
      )}

      {/* Description + notes */}
      {(item.description || item.notes) && (
        <div style={{ display: 'grid', gridTemplateColumns: item.description && item.notes ? '1fr 1fr' : '1fr', gap: 16, marginTop: 16 }}>
          {item.description && (
            <div>
              <div style={styles.sectionLabel}>Beskrivning</div>
              <div style={styles.textBlock}>{item.description}</div>
            </div>
          )}
          {item.notes && (
            <div>
              <div style={styles.sectionLabel}>Anteckningar</div>
              <div style={styles.textBlock}>{item.notes}</div>
            </div>
          )}
        </div>
      )}

      {/* Tags */}
      {item.tags && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 14 }}>
          {item.tags.split(',').filter(Boolean).map(tg => (
            <button key={tg} onClick={() => onTagClick(tg)}
              style={{ ...styles.tagChip, cursor: 'pointer' }}>
              {tg}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const styles = {
  filterRow:  { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  filterBtn:  { padding: '5px 14px', borderRadius: 99, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .12s', display: 'flex', alignItems: 'center', gap: 5 },
  countBadge: { fontSize: 10, background: '#1e6fbf', color: '#fff', borderRadius: 99, padding: '1px 6px', fontWeight: 700 },
  tagRow:     { display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 20, alignItems: 'center' },
  filterLabel:{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 500, marginRight: 2 },
  tagBtn:     { padding: '3px 10px', borderRadius: 99, fontSize: 11, border: '0.5px solid var(--color-border-secondary)', background: 'var(--color-background-primary)', color: 'var(--color-text-secondary)', cursor: 'pointer', fontFamily: 'inherit' },
  tagBtnActive: { background: '#dbeafe', color: '#1e40af', border: '0.5px solid #93c5fd', fontWeight: 500 },
  tagChip:    { fontSize: 10, padding: '2px 7px', borderRadius: 99, border: 'none', fontFamily: 'inherit', fontWeight: 500 },
  grid:       { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 },
  coverWrap:  { position: 'relative', cursor: 'pointer', borderRadius: 'var(--border-radius-md)', overflow: 'hidden' },
  coverImg:   { width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' },
  photoCount: { position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 10, padding: '2px 6px', borderRadius: 99 },
  noCover:    { aspectRatio: '1', background: 'var(--color-background-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderRadius: 'var(--border-radius-md)', marginBottom: 0 },
  nameBtn:    { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'var(--font)', padding: 0, textAlign: 'left', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3 },

  // Expanded
  expandedCard:   { background: 'var(--color-background-primary)', border: '1.5px solid #60a5fa', borderRadius: 'var(--border-radius-lg)', padding: '20px 24px', marginBottom: 24, boxShadow: '0 4px 24px rgba(30,111,191,.12)' },
  expandedHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 },
  expandedName:   { fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)' },
  publishedBadge: { fontSize: 11, padding: '2px 8px', borderRadius: 99, background: '#d1fae5', color: '#065f46', fontWeight: 500 },
  photoGrid:      { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 },
  photoThumb:     { borderRadius: 'var(--border-radius-md)', overflow: 'hidden', background: 'var(--color-background-secondary)', cursor: 'pointer' },
  photoImg:       { width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' },
  photoTitle:     { fontSize: 11, padding: '4px 8px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  addPhotoBtn:    { borderRadius: 'var(--border-radius-md)', border: '2px dashed var(--color-border-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', aspectRatio: '1', cursor: 'pointer', color: 'var(--color-text-secondary)', gap: 4, transition: 'border-color .15s' },
  noPhotos:       { border: '2px dashed var(--color-border-secondary)', borderRadius: 'var(--border-radius-md)', padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 16 },
  sectionLabel:   { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--color-text-secondary)', marginBottom: 6 },
  textBlock:      { fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.6, background: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)', padding: '10px 14px' },
}
