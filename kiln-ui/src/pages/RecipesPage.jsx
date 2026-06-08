import React, { useEffect, useState } from 'react'
import { recipesApi } from '../lib/api'
import { useLang } from '../i18n/index.jsx'
import { Button, EmptyState, PageHeader, Card } from '../components/UI'
import RecipeModal from './RecipeModal'
import RevisionHistory from '../components/RevisionHistory'

const SURFACE_COLORS = {
  matte:  { bg: '#f3f4f6', color: '#4b5563' },
  satin:  { bg: '#eff6ff', color: '#1d4ed8' },
  gloss:  { bg: '#ecfdf5', color: '#065f46' },
}
const FIRING_COLORS = {
  oxidation: { bg: '#fef3c7', color: '#92400e' },
  reduction:  { bg: '#f3e8ff', color: '#6b21a8' },
}
const BAR_PALETTE = ['#1e6fbf','#059669','#d97706','#dc2626','#7c3aed','#0891b2','#be185d','#65a30d']

export default function RecipesPage({ toast }) {
  const { t } = useLang()
  const [recipes, setRecipes]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [editing, setEditing]   = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [expanded, setExpanded] = useState(null)

  async function load() {
    setLoading(true)
    try { setRecipes(await recipesApi.list()) }
    catch (e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function handleSave(data) {
    try {
      if (editing?.id) await recipesApi.update(editing.id, data)
      else await recipesApi.create(data)
      toast(t('recipe_saved'))
      setModalOpen(false)
      load()
    } catch (e) { toast(e.message, 'error') }
  }

  async function handleDelete(id) {
    if (!confirm(t('confirm_delete_recipe'))) return
    try {
      await recipesApi.delete(id)
      toast(t('recipe_deleted'))
      if (expanded === id) setExpanded(null)
      load()
    } catch (e) { toast(e.message, 'error') }
  }

  async function openRevision(rev) {
    try {
      const full = await recipesApi.get(rev.id)
      setEditing(full)
      setModalOpen(true)
    } catch (e) { toast(e.message, 'error') }
  }

  const expandedRecipe = recipes.find(r => r.id === expanded)

  return (
    <div>
      <PageHeader
        title={t('recipes_title')}
        subtitle={t('recipes_subtitle')}
        action={<Button variant="primary" onClick={() => { setEditing(null); setModalOpen(true) }}>{t('recipes_new')}</Button>}
      />

      {loading ? (
        <div style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>{t('loading')}</div>
      ) : recipes.length === 0 ? (
        <EmptyState
          icon="⚗️"
          title={t('recipe_empty_title')}
          description={t('recipe_empty_desc')}
          action={<Button variant="primary" onClick={() => { setEditing(null); setModalOpen(true) }}>{t('recipes_new')}</Button>}
        />
      ) : (
        <>
          {/* Expanded full-width card */}
          {expandedRecipe && (
            <ExpandedRecipeCard
              recipe={expandedRecipe}
              onEdit={() => { setEditing(expandedRecipe); setModalOpen(true) }}
              onDelete={() => handleDelete(expandedRecipe.id)}
              onClose={() => setExpanded(null)}
              onSelectRevision={rev => openRevision(rev)}
              onDeleteRevision={id => handleDelete(id)}
              t={t}
            />
          )}

          {/* Grid */}
          <div style={styles.grid}>
            {recipes.map(r => {
              const isExpanded = r.id === expanded
              return (
                <Card key={r.id} style={isExpanded ? { opacity: 0.5, pointerEvents: 'none' } : {}}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <button
                          onClick={() => setExpanded(isExpanded ? null : r.id)}
                          style={styles.nameBtn}
                        >
                          {r.name}
                        </button>
                        <span style={styles.revBadge}>r{r.revision ?? 1}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {r.cone && <Pill label={r.cone} />}
                        {r.surface && <Pill label={r.surface} colors={SURFACE_COLORS[r.surface?.toLowerCase()]} />}
                        {r.firing_type && <Pill label={r.firing_type} colors={FIRING_COLORS[r.firing_type?.toLowerCase()]} />}
                        {r.color && <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>→ {r.color}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <Button size="sm" onClick={() => { setEditing(r); setModalOpen(true) }}>{t('edit')}</Button>
                      <Button size="sm" variant="danger" onClick={() => handleDelete(r.id)}>{t('delete')}</Button>
                    </div>
                  </div>

                  {r.ingredients?.length > 0 && (
                    <>
                      <IngredientBar ingredients={r.ingredients} />
                      <div style={styles.ingredientList}>
                        {r.ingredients.slice(0, 4).map(ing => {
                          const total = r.ingredients.reduce((s, i) => s + i.amount, 0)
                          const pct = total > 0 ? ((ing.amount / total) * 100).toFixed(1) : '–'
                          return (
                            <div key={ing.id} style={styles.ingRow}>
                              <span style={{ color: 'var(--color-text-primary)', fontWeight: 500, fontSize: 12 }}>{ing.element?.name}</span>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-secondary)' }}>
                                {ing.amount}g ({pct}%)
                              </span>
                            </div>
                          )
                        })}
                        {r.ingredients.length > 4 && (
                          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                            +{r.ingredients.length - 4} till…
                          </div>
                        )}
                        <div style={{ ...styles.ingRow, borderTop: '0.5px solid var(--color-border-tertiary)', paddingTop: 4, marginTop: 2 }}>
                          <span style={{ color: 'var(--color-text-secondary)', fontSize: 11 }}>Total</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500 }}>
                            {r.ingredients.reduce((s, i) => s + i.amount, 0)}g
                          </span>
                        </div>
                      </div>
                    </>
                  )}

                  {r.notes && (
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', borderTop: '0.5px solid var(--color-border-tertiary)', paddingTop: 8, marginTop: 8 }}>
                      {r.notes}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        </>
      )}

      <RecipeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        initial={editing}
        toast={toast}
      />
    </div>
  )
}

// ── Expanded full-width recipe card ───────────────────────────
function ExpandedRecipeCard({ recipe: r, onEdit, onDelete, onClose, onSelectRevision, onDeleteRevision, t }) {
  const total = (r.ingredients || []).reduce((s, i) => s + i.amount, 0)

  return (
    <div style={styles.expandedCard}>
      {/* Header */}
      <div style={styles.expandedHeader}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={styles.expandedName}>{r.name}</span>
            <span style={styles.revBadge}>r{r.revision ?? 1}</span>
            {r.surface && <Pill label={r.surface} colors={SURFACE_COLORS[r.surface?.toLowerCase()]} />}
            {r.firing_type && <Pill label={r.firing_type} colors={FIRING_COLORS[r.firing_type?.toLowerCase()]} />}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
            {r.cone && <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>📐 {r.cone}</span>}
            {r.color && <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>🎨 {r.color}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="sm" onClick={onEdit}>{t('edit')}</Button>
          <Button size="sm" variant="danger" onClick={onDelete}>{t('delete')}</Button>
          <Button size="sm" variant="ghost" onClick={onClose}>✕ Stäng</Button>
        </div>
      </div>

      {/* Two-column layout: bar chart + table */}
      {r.ingredients?.length > 0 && (
        <div style={styles.expandedBody}>
          {/* Left: stacked bar */}
          <div style={styles.barCol}>
            <div style={styles.sectionLabel}>Sammansättning</div>
            <IngredientBar ingredients={r.ingredients} height={20} />
            {/* Legend */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 8 }}>
              {r.ingredients.map((ing, i) => (
                <div key={ing.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: BAR_PALETTE[i % BAR_PALETTE.length], flexShrink: 0 }} />
                  <span style={{ color: 'var(--color-text-secondary)' }}>{ing.element?.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: full ingredient table */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={styles.sectionLabel}>Ingredienser</div>
            <table style={styles.ingTable}>
              <thead>
                <tr>
                  {['Råmaterial', 'Mängd', '%', 'Anteckningar'].map(h => (
                    <th key={h} style={styles.ingTh}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...r.ingredients]
                  .sort((a, b) => b.amount - a.amount)
                  .map((ing, i) => {
                    const pct = total > 0 ? ((ing.amount / total) * 100).toFixed(1) : '–'
                    return (
                      <tr key={ing.id} style={{ borderTop: '0.5px solid var(--color-border-tertiary)' }}>
                        <td style={styles.ingTd}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: BAR_PALETTE[i % BAR_PALETTE.length], flexShrink: 0 }} />
                            <span style={{ fontWeight: 500 }}>{ing.element?.name}</span>
                          </div>
                          {ing.element?.chemical_formula && (
                            <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginLeft: 16, fontFamily: 'var(--font-mono)' }}>
                              {ing.element.chemical_formula}
                            </div>
                          )}
                        </td>
                        <td style={{ ...styles.ingTd, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{ing.amount}g</td>
                        <td style={{ ...styles.ingTd, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{pct}%</td>
                        <td style={{ ...styles.ingTd, color: 'var(--color-text-secondary)', fontSize: 12 }}>{ing.notes || '—'}</td>
                      </tr>
                    )
                  })}
                <tr style={{ borderTop: '1px solid var(--color-border-secondary)' }}>
                  <td style={{ ...styles.ingTd, fontWeight: 600 }}>Total</td>
                  <td style={{ ...styles.ingTd, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{total}g</td>
                  <td style={{ ...styles.ingTd, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>100%</td>
                  <td style={styles.ingTd} />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Notes */}
      {r.notes && (
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6, marginTop: 16, padding: '12px 16px', background: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)' }}>
          {r.notes}
        </div>
      )}

      {/* Revision history in expanded view */}
      <div style={{ marginTop: 20, borderTop: '0.5px solid var(--color-border-tertiary)', paddingTop: 16 }}>
        <RevisionHistory
          fetchRevisions={() => recipesApi.revisions(r.id)}
          fetchDiff={(a, b) => recipesApi.diff(a, b)}
          currentId={r.id}
          onSelect={onSelectRevision}
          onDelete={onDeleteRevision}
          label="recept"
        />
      </div>
    </div>
  )
}

// ── Shared components ─────────────────────────────────────────
function Pill({ label, colors }) {
  const c = colors || { bg: '#f3f4f6', color: '#4b5563' }
  return (
    <span style={{ ...c, fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 500, textTransform: 'capitalize' }}>
      {label}
    </span>
  )
}

function IngredientBar({ ingredients, height = 8 }) {
  const total = ingredients.reduce((s, i) => s + i.amount, 0)
  if (total === 0) return null
  return (
    <div style={{ display: 'flex', height, borderRadius: 99, overflow: 'hidden', marginBottom: 8, gap: 1 }}>
      {ingredients.map((ing, i) => (
        <div
          key={ing.id}
          title={`${ing.element?.name}: ${((ing.amount / total) * 100).toFixed(1)}%`}
          style={{ flex: ing.amount / total, background: BAR_PALETTE[i % BAR_PALETTE.length], minWidth: 2 }}
        />
      ))}
    </div>
  )
}

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: 16,
  },
  nameBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)',
    fontFamily: 'var(--font)', padding: 0, textAlign: 'left',
    textDecoration: 'underline', textDecorationStyle: 'dotted',
    textUnderlineOffset: 3,
  },
  revBadge: {
    fontSize: 10, fontWeight: 700, padding: '2px 6px',
    borderRadius: 4, background: '#e0f2fe', color: '#0369a1',
    fontFamily: 'var(--font-mono)', flexShrink: 0,
  },
  ingredientList: { display: 'flex', flexDirection: 'column', gap: 3 },
  ingRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontSize: 12, padding: '2px 0',
  },

  // Expanded
  expandedCard: {
    background: 'var(--color-background-primary)',
    border: '1.5px solid #60a5fa',
    borderRadius: 'var(--border-radius-lg)',
    padding: '20px 24px',
    marginBottom: 24,
    boxShadow: '0 4px 24px rgba(30,111,191,.12)',
  },
  expandedHeader: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 10,
  },
  expandedName: {
    fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)',
  },
  expandedBody: {
    display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-start',
  },
  barCol: {
    minWidth: 200, flex: '0 0 220px',
  },
  sectionLabel: {
    fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '.8px', color: 'var(--color-text-secondary)', marginBottom: 10,
  },
  ingTable: {
    width: '100%', borderCollapse: 'collapse', fontSize: 13,
  },
  ingTh: {
    padding: '7px 12px', textAlign: 'left',
    fontSize: 11, fontWeight: 500, textTransform: 'uppercase',
    letterSpacing: '.6px', color: 'var(--color-text-secondary)',
    background: 'var(--color-background-secondary)',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    whiteSpace: 'nowrap',
  },
  ingTd: {
    padding: '8px 12px', color: 'var(--color-text-primary)',
    verticalAlign: 'middle',
  },
}
