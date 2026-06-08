import React, { useState, useRef, useEffect } from 'react'
import { useLang } from '../i18n/index.jsx'
import Modal from '../components/Modal'
import { Button, FormField, Input, Textarea } from '../components/UI'
import { photosApi } from '../lib/api'

/**
 * PhotoUploadModal
 * Props:
 *   open        — bool
 *   onClose     — fn
 *   onUploaded  — fn(photo) called after successful upload
 *   toast       — fn
 *   defaultBurnId   — pre-fill burn link
 *   defaultRecipeId — pre-fill recipe link
 *   existingTags    — string[] of known tags for autocomplete
 */
export default function PhotoUploadModal({
  open, onClose, onUploaded, toast,
  defaultBurnId, defaultRecipeId, existingTags = [],
}) {
  const { t } = useLang()
  const [file, setFile]       = useState(null)
  const [preview, setPreview] = useState(null)
  const [title, setTitle]     = useState('')
  const [notes, setNotes]     = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags]       = useState([])
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    if (!open) {
      setFile(null); setPreview(null)
      setTitle(''); setNotes(''); setTagInput(''); setTags([])
    }
  }, [open])

  function handleFile(f) {
    if (!f) return
    setFile(f)
    setTitle(t => t || f.name.replace(/\.[^.]+$/, ''))
    const url = URL.createObjectURL(f)
    setPreview(url)
  }

  function handleDrop(e) {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f && f.type.startsWith('image/')) handleFile(f)
  }

  function addTag(t) {
    const clean = t.trim().toLowerCase()
    if (clean && !tags.includes(clean)) setTags(prev => [...prev, clean])
    setTagInput('')
  }

  function removeTag(t) {
    setTags(prev => prev.filter(x => x !== t))
  }

  async function handleUpload() {
    if (!file) return toast('Välj en fil', 'error')
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file',  file)
      fd.append('title', title)
      fd.append('notes', notes)
      fd.append('tags',  tags.join(','))
      if (defaultBurnId)   fd.append('burn_id',   defaultBurnId)
      if (defaultRecipeId) fd.append('recipe_id', defaultRecipeId)

      const photo = await photosApi.upload(fd)
      toast(t('photo_uploaded'))
      onUploaded(photo)
      onClose()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setUploading(false)
    }
  }

  const suggTags = existingTags.filter(t =>
    tagInput && t.includes(tagInput.toLowerCase()) && !tags.includes(t)
  ).slice(0, 6)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Upload Photo"
      width={560}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? 'Laddar upp…' : t('photo_upload_btn')}
          </Button>
        </>
      }
    >
      {/* Drop zone */}
      <div
        style={{
          ...styles.dropZone,
          borderColor: dragOver ? '#1e6fbf' : preview ? '#6ee7b7' : 'var(--color-border-secondary)',
          background:  dragOver ? '#eff6ff' : 'var(--color-background-secondary)',
        }}
        onClick={() => fileRef.current.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <input
          ref={fileRef} type="file" accept="image/*"
          style={{ display: 'none' }}
          onChange={e => handleFile(e.target.files[0])}
        />
        {preview ? (
          <img src={preview} alt="preview" style={styles.preview} />
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Click or drag an image here</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>JPEG, PNG, WebP — max 20MB</div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
        <FormField label="Title">
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Mug batch June" />
        </FormField>

        <FormField label="Notes">
          <Textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Any notes about this photo…" style={{ minHeight: 60 }} />
        </FormField>

        {/* Tag input */}
        <FormField label="Tags" hint="Press Enter or comma to add. Previously used tags appear as suggestions.">
          <div>
            {/* Existing tags */}
            {tags.length > 0 && (
              <div style={styles.tagList}>
                {tags.map(t => (
                  <span key={t} style={styles.tag}>
                    {t}
                    <button onClick={() => removeTag(t)} style={styles.tagRemove}>×</button>
                  </span>
                ))}
              </div>
            )}
            <Input
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault(); addTag(tagInput)
                } else if (e.key === 'Backspace' && !tagInput && tags.length) {
                  removeTag(tags[tags.length - 1])
                }
              }}
              placeholder={tags.length ? '' : t('photo_tags_ph')}
            />
            {/* Suggestions */}
            {suggTags.length > 0 && (
              <div style={styles.suggestions}>
                {suggTags.map(t => (
                  <button key={t} style={styles.suggBtn} onClick={() => addTag(t)}>{t}</button>
                ))}
              </div>
            )}
          </div>
        </FormField>
      </div>
    </Modal>
  )
}

const styles = {
  dropZone: {
    border: '2px dashed',
    borderRadius: 'var(--border-radius-lg)',
    padding: 24,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
    transition: 'all .15s',
  },
  preview: {
    maxHeight: 220, maxWidth: '100%',
    borderRadius: 'var(--border-radius-md)',
    objectFit: 'contain',
  },
  tagList: {
    display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8,
  },
  tag: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '3px 8px', borderRadius: 99, fontSize: 12, fontWeight: 500,
    background: '#dbeafe', color: '#1e40af',
  },
  tagRemove: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#1e40af', fontSize: 14, lineHeight: 1, padding: 0,
  },
  suggestions: {
    display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6,
  },
  suggBtn: {
    padding: '3px 10px', borderRadius: 99, fontSize: 11,
    background: 'var(--color-background-secondary)',
    border: '0.5px solid var(--color-border-secondary)',
    color: 'var(--color-text-secondary)',
    cursor: 'pointer', fontFamily: 'inherit',
  },
}
