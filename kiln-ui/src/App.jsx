import React, { useState } from 'react'
import Sidebar from './components/Sidebar'
import { Toast } from './components/UI'
import { useToast } from './hooks/useToast'
import KilnsPage from './pages/KilnsPage'
import TemplatesPage from './pages/TemplatesPage'
import BurnsPage from './pages/BurnsPage'
import BurnDetailPage from './pages/BurnDetailPage'
import ElementsPage from './pages/ElementsPage'
import RecipesPage from './pages/RecipesPage'
import SettingsPage from './pages/SettingsPage'
import PhotosPage from './pages/PhotosPage'

export default function App() {
  const [page, setPage]         = useState('kilns')
  const [viewingBurnId, setViewingBurnId] = useState(null)
  const { toast, show: showToast } = useToast()

  function navigate(target) {
    setPage(target)
    // Clear burn detail when navigating away
    if (target !== 'burn-detail') setViewingBurnId(null)
  }

  function viewBurn(id) {
    setViewingBurnId(id)
    setPage('burn-detail')
  }

  return (
    <div style={styles.app}>
      <Sidebar active={page === 'burn-detail' ? 'burns' : page} onNavigate={navigate} />

      <main style={styles.main}>
        <div style={styles.content}>
          {page === 'kilns' && (
            <KilnsPage toast={showToast} />
          )}
          {page === 'templates' && (
            <TemplatesPage toast={showToast} />
          )}
          {page === 'burns' && (
            <BurnsPage toast={showToast} onViewBurn={viewBurn} />
          )}
          {page === 'burn-detail' && viewingBurnId && (
            <BurnDetailPage
              burnId={viewingBurnId}
              onBack={() => navigate('burns')}
              toast={showToast}
            />
          )}
          {page === 'elements' && (
            <ElementsPage toast={showToast} />
          )}
          {page === 'recipes' && (
            <RecipesPage toast={showToast} />
          )}
          {page === 'photos' && (
            <PhotosPage toast={showToast} />
          )}
          {page === 'settings' && (
            <SettingsPage toast={showToast} />
          )}
        </div>
      </main>

      <Toast toast={toast} />
    </div>
  )
}

const styles = {
  app: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
    background: 'var(--bg)',
  },
  main: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  content: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '32px 32px',
  },
}
