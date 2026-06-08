import React, { useState } from 'react'
import { useLang } from '../i18n/index.jsx'
import { burnsApi } from '../lib/api'
import { Button, Card } from '../components/UI'

/**
 * CommentsPanel
 * Props:
 *   burnId       — burn id
 *   comments     — BurnCommentOut[]
 *   currentMin   — current elapsed minutes (from latest log, for "pin to now" button)
 *   onRefresh    — reload callback
 *   toast        — toast function
 */
export default function CommentsPanel({ burnId, comments = [], currentMin, onRefresh, toast }) {
  const { t } = useLang()
  const [text, setText]       = useState('')
  const [author, setAuthor]   = useState('')
  const [atTime, setAtTime]   = useState('')
  const [pinNow, setPinNow]   = useState(false)
  const [editing, setEditing] = useState(null)   // comment id being edited
  const [editText, setEditText] = useState('')

  async function handleAdd() {
    if (!text.trim()) return
    const elapsed = pinNow && currentMin != null
      ? currentMin
      : atTime !== '' ? parseFloat(atTime) : null

    try {
      await burnsApi.addComment(burnId, {
        text: text.trim(),
        author: author.trim(),
        elapsed_minutes: elapsed,
      })
      setText('')
      setAtTime('')
      setPinNow(false)
      toast(t('comment_added'))
      onRefresh()
    } catch (e) { toast(e.message, 'error') }
  }

  async function handleEdit(c) {
    setEditing(c.id)
    setEditText(c.text)
  }

  async function handleSaveEdit(commentId) {
    try {
      await burnsApi.updateComment(burnId, commentId, { text: editText })
      setEditing(null)
      toast(t('comment_updated'))
      onRefresh()
    } catch (e) { toast(e.message, 'error') }
  }

  async function handleDelete(commentId) {
    if (!confirm(t('confirm_delete_comment'))) return
    try {
      await burnsApi.deleteComment(burnId, commentId)
      toast(t('comment_deleted'))
      onRefresh()
    } catch (e) { toast(e.message, 'error') }
  }

  return (
    <Card style={{ marginBottom: 20 }}>
      <div style={styles.header}>
        <div style={styles.sectionLabel}>Comments</div>
        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
          {comments.length} {comments.length === 1 ? 'note' : t('comments_notes')}
        </span>
      </div>

      {/* Add comment form */}
      <div style={styles.addForm}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Add a note… e.g. 'Glaze starting to melt', 'Adjusted vent'"
          style={styles.textarea}
          rows={2}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAdd()
          }}
        />
        <div style={styles.formRow}>
          <input
            value={author}
            onChange={e => setAuthor(e.target.value)}
            placeholder="Your name (optional)"
            style={styles.authorInput}
          />

          {/* Time pin */}
          <div style={styles.timeRow}>
            {currentMin != null && (
              <button
                onClick={() => { setPinNow(!pinNow); setAtTime('') }}
                style={{
                  ...styles.pinBtn,
                  background: pinNow ? '#dbeafe' : 'var(--color-background-secondary)',
                  color: pinNow ? '#1e6fbf' : 'var(--color-text-secondary)',
                  border: `0.5px solid ${pinNow ? '#93c5fd' : 'var(--color-border-secondary)'}`,
                }}
              >
                📍 {pinNow ? `${currentMin.toFixed(1)} min` : 'Pin to now'}
              </button>
            )}
            {!pinNow && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>at</span>
                <input
                  type="number"
                  placeholder="min"
                  value={atTime}
                  onChange={e => setAtTime(e.target.value)}
                  style={styles.timeInput}
                />
                <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>min</span>
              </div>
            )}
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={handleAdd}
            disabled={!text.trim()}
          >
            Add
          </Button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4 }}>
          Ctrl+Enter to submit
        </div>
      </div>

      {/* Comment list */}
      {comments.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>
          No comments yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
          {comments.map(c => (
            <div key={c.id} style={styles.commentRow}>
              {/* Time marker */}
              <div style={styles.timeMarker}>
                {c.elapsed_minutes != null ? (
                  <span style={styles.timeBadge}>
                    {c.elapsed_minutes.toFixed(1)} min
                  </span>
                ) : (
                  <span style={styles.timeBadgeEmpty}>–</span>
                )}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {editing === c.id ? (
                  <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
                    <textarea
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      style={{ ...styles.textarea, minHeight: 60 }}
                      rows={2}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Button size="sm" variant="primary" onClick={() => handleSaveEdit(c.id)}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={styles.commentText}>{c.text}</div>
                    <div style={styles.commentMeta}>
                      {c.author && <span style={{ fontWeight: 500 }}>{c.author} · </span>}
                      {fmtDateTime(c.created_at)}
                    </div>
                  </>
                )}
              </div>

              {/* Actions */}
              {editing !== c.id && (
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <Button size="sm" variant="ghost" onClick={() => handleEdit(c)}
                    style={{ fontSize: 11, padding: '3px 8px' }}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => handleDelete(c.id)}
                    style={{ fontSize: 11, padding: '3px 8px' }}>✕</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function fmtDateTime(s) {
  if (!s) return ''
  const d = new Date(s)
  return d.toLocaleString('sv-SE').replace('T', ' ').slice(0, 16)
}

const styles = {
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 11, fontWeight: 500, textTransform: 'uppercase',
    letterSpacing: '1px', color: 'var(--color-text-secondary)',
  },
  addForm: {
    background: 'var(--color-background-secondary)',
    borderRadius: 'var(--border-radius-md)',
    padding: '12px',
  },
  textarea: {
    width: '100%', padding: '8px 10px',
    background: 'var(--color-background-primary)',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 'var(--border-radius-md)',
    color: 'var(--color-text-primary)',
    fontFamily: 'var(--font)', fontSize: 13,
    resize: 'vertical', outline: 'none',
    lineHeight: 1.5,
  },
  formRow: {
    display: 'flex', gap: 8, alignItems: 'center',
    marginTop: 8, flexWrap: 'wrap',
  },
  authorInput: {
    flex: 1, minWidth: 120, maxWidth: 200,
    padding: '6px 10px', fontSize: 12,
    background: 'var(--color-background-primary)',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 'var(--border-radius-md)',
    color: 'var(--color-text-primary)',
    fontFamily: 'var(--font)', outline: 'none',
  },
  timeRow: {
    display: 'flex', alignItems: 'center', gap: 6,
  },
  pinBtn: {
    padding: '5px 10px', borderRadius: 'var(--border-radius-md)',
    cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font)',
    fontWeight: 500, whiteSpace: 'nowrap', transition: 'all .15s',
  },
  timeInput: {
    width: 64, padding: '5px 8px', fontSize: 12,
    fontFamily: 'var(--font-mono)',
    background: 'var(--color-background-primary)',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 'var(--border-radius-md)',
    color: 'var(--color-text-primary)', outline: 'none',
  },
  commentRow: {
    display: 'flex', gap: 12, alignItems: 'flex-start',
    padding: '10px 12px',
    background: 'var(--color-background-primary)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 'var(--border-radius-md)',
  },
  timeMarker: {
    flexShrink: 0, paddingTop: 2,
  },
  timeBadge: {
    display: 'inline-block',
    fontFamily: 'var(--font-mono)', fontSize: 11,
    padding: '2px 7px', borderRadius: 99,
    background: '#dbeafe', color: '#1e6fbf',
    fontWeight: 500, whiteSpace: 'nowrap',
  },
  timeBadgeEmpty: {
    display: 'inline-block', fontSize: 11,
    padding: '2px 7px', borderRadius: 99,
    background: 'var(--color-background-secondary)',
    color: 'var(--color-text-secondary)',
  },
  commentText: {
    fontSize: 13, color: 'var(--color-text-primary)',
    lineHeight: 1.5, whiteSpace: 'pre-wrap', marginBottom: 4,
  },
  commentMeta: {
    fontSize: 11, color: 'var(--color-text-secondary)',
  },
}
