import React, { useState } from 'react'
import { kilnsApi } from '../lib/api'
import { useLang } from '../i18n/index.jsx'
import Modal from '../components/Modal'
import { Button } from '../components/UI'

export default function KilnTestModal({ open, onClose, kiln }) {
  const { t } = useLang()
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState(null)
  const [error, setError]     = useState(null)

  async function handleShowTemperature() {
    setLoading(true)
    setError(null)
    try {
      setResult(await kilnsApi.testTemperature(kiln.id))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setResult(null)
    setError(null)
    onClose()
  }

  if (!kiln) return null

  return (
    <Modal open={open} onClose={handleClose} title={`${t('kiln_test_title')} — ${kiln.name}`} width={420}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '8px 0' }}>
        <Button variant="primary" onClick={handleShowTemperature} disabled={loading}>
          {loading ? t('kiln_test_reading') : t('kiln_test_show_temp')}
        </Button>

        {result && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 32, fontWeight: 600, color: 'var(--accent)' }}>
              {result.temperature}°C
            </div>
            {result.mock && (
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>
                {t('kiln_test_mock_note')}
              </div>
            )}
          </div>
        )}

        {error && (
          <div style={{ fontSize: 13, color: 'var(--danger)', textAlign: 'center' }}>{error}</div>
        )}
      </div>
    </Modal>
  )
}
