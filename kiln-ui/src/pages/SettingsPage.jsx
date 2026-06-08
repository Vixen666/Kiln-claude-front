import React, { useEffect, useState } from 'react'
import { settingsApi } from '../lib/api'
import { useLang } from '../i18n/index.jsx'
import { Button, PageHeader, Card, FormField, Input, SectionDivider } from '../components/UI'

const DEFAULTS = {
  discord_enabled: false, discord_webhook_url: '',
  resend_enabled: false, resend_api_key: '', resend_from_email: '', resend_to_email: '',
  ntfy_enabled: false, ntfy_topic: '', ntfy_server: 'https://ntfy.sh',
}

export default function SettingsPage({ toast }) {
  const { t, lang, setLanguage } = useLang()
  const [form, setForm]     = useState(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]     = useState(false)
  const [testing, setTesting]   = useState(false)
  const [testResult, setTestResult] = useState(null)

  useEffect(() => {
    settingsApi.get()
      .then(s => setForm({ ...DEFAULTS, ...s }))
      .catch(e => toast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [])

  const set    = key => e => setForm(f => ({ ...f, [key]: e.target.value }))
  const toggle = key => () => setForm(f => ({ ...f, [key]: !f[key] }))

  async function handleSave() {
    setSaving(true)
    try {
      await settingsApi.update(form)
      toast(t('settings_saved'))
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await settingsApi.testNotification()
      setTestResult({ ok: res.ok, message: res.message })
      if (res.ok) toast(t('settings_test_sent'))
      else toast(res.message, 'error')
    } catch (e) {
      setTestResult({ ok: false, message: e.message })
      toast(e.message, 'error')
    } finally {
      setTesting(false)
    }
  }

  if (loading) return <div style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>Loading…</div>

  return (
    <div style={{ maxWidth: 640 }}>
      <PageHeader
        title="Settings"
        subtitle="Configure notifications for segment completions"
      />

      {/* How notifications work */}
      <div style={styles.infoBox}>
        <strong>How it works:</strong> When your PID controller posts a log entry with
        {' '}<code style={styles.code}>event: "segment_change"</code>, the backend checks
        if that segment has <em>Notify on complete</em> enabled in the template.
        If so, it fires all enabled channels below.
      </div>

      {/* ── Discord ── */}
      <Card style={{ marginBottom: 16 }}>
        <div style={styles.channelHeader}>
          <div>
            <div style={styles.channelTitle}>
              <DiscordIcon /> Discord
            </div>
            <div style={styles.channelSub}>Posts a message to a Discord channel via webhook. Free, instant.</div>
          </div>
          <Toggle enabled={form.discord_enabled} onToggle={toggle('discord_enabled')} />
        </div>
        {form.discord_enabled && (
          <div style={{ marginTop: 16 }}>
            <SectionDivider>Configuration</SectionDivider>
            <div style={{ marginTop: 10 }}>
              <FormField
                label="Webhook URL"
                hint="In Discord: channel settings → Integrations → Webhooks → New Webhook → Copy URL"
              >
                <Input
                  value={form.discord_webhook_url}
                  onChange={set('discord_webhook_url')}
                  placeholder="https://discord.com/api/webhooks/..."
                />
              </FormField>
            </div>
            <HowTo steps={[
              t('discord_how_1'),
              t('discord_how_2'),
              t('discord_how_3'),
              t('discord_how_4'),
            ]} />
          </div>
        )}
      </Card>

      {/* ── Resend email ── */}
      <Card style={{ marginBottom: 16 }}>
        <div style={styles.channelHeader}>
          <div>
            <div style={styles.channelTitle}>
              <EmailIcon /> Email via Resend
            </div>
            <div style={styles.channelSub}>Free tier: 100 emails/day. No credit card needed.</div>
          </div>
          <Toggle enabled={form.resend_enabled} onToggle={toggle('resend_enabled')} />
        </div>
        {form.resend_enabled && (
          <div style={{ marginTop: 16 }}>
            <SectionDivider>Configuration</SectionDivider>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', marginTop: 10 }}>
              <FormField label="API Key" hint="From resend.com dashboard" span={2}>
                <Input
                  value={form.resend_api_key}
                  onChange={set('resend_api_key')}
                  placeholder="re_..."
                  type="password"
                />
              </FormField>
              <FormField label="From email" hint="Must be verified in Resend">
                <Input
                  value={form.resend_from_email}
                  onChange={set('resend_from_email')}
                  placeholder="kiln@yourdomain.com"
                />
              </FormField>
              <FormField label="To email" hint="Where to send notifications">
                <Input
                  value={form.resend_to_email}
                  onChange={set('resend_to_email')}
                  placeholder="you@example.com"
                />
              </FormField>
            </div>
            <HowTo steps={[
              t('email_how_1'),
              t('email_how_2'),
              t('email_how_3'),
              t('email_how_4'),
            ]} />
          </div>
        )}
      </Card>

      {/* ── Ntfy ── */}
      <Card style={{ marginBottom: 24 }}>
        <div style={styles.channelHeader}>
          <div>
            <div style={styles.channelTitle}>
              <NtfyIcon /> Ntfy.sh push notifications
            </div>
            <div style={styles.channelSub}>Free and open source. Install the Ntfy app on your phone.</div>
          </div>
          <Toggle enabled={form.ntfy_enabled} onToggle={toggle('ntfy_enabled')} />
        </div>
        {form.ntfy_enabled && (
          <div style={{ marginTop: 16 }}>
            <SectionDivider>Configuration</SectionDivider>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', marginTop: 10 }}>
              <FormField
                label="Topic"
                hint="Pick any unique name — anyone who knows it can subscribe"
              >
                <Input
                  value={form.ntfy_topic}
                  onChange={set('ntfy_topic')}
                  placeholder="my-kiln-abc123"
                />
              </FormField>
              <FormField
                label="Server"
                hint="Use ntfy.sh or your own self-hosted server"
              >
                <Input
                  value={form.ntfy_server}
                  onChange={set('ntfy_server')}
                  placeholder="https://ntfy.sh"
                />
              </FormField>
            </div>
            <HowTo steps={[
              t('ntfy_how_1'),
              'Choose a unique topic name e.g. "kiln-yourname-2024" and enter it above',
              t('ntfy_how_3'),
              t('ntfy_how_4'),
            ]} />
          </div>
        )}
      </Card>

      {/* Language toggle */}
      <div style={{ marginBottom: 24, padding: '16px 0', borderTop: '1px solid var(--color-border-tertiary)', borderBottom: '1px solid var(--color-border-tertiary)' }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 10 }}>{t('language')}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['sv','en'].map(code => (
            <button
              key={code}
              onClick={() => setLanguage(code)}
              style={{
                padding: '7px 20px', borderRadius: 6, border: 'none',
                cursor: 'pointer', fontSize: 13, fontWeight: 500,
                fontFamily: 'inherit',
                background: lang === code ? '#1e6fbf' : 'var(--color-background-secondary)',
                color: lang === code ? '#fff' : 'var(--color-text-secondary)',
                transition: 'all .15s',
              }}
            >
              {code === 'sv' ? '🇸🇪 Svenska' : '🇬🇧 English'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? t('saving') : t('save') + ' ' + t('settings_title').toLowerCase()}
        </Button>
        <Button variant="ghost" onClick={handleTest} disabled={testing}>
          {testing ? t('settings_testing') : t('settings_test')}
        </Button>
        {testResult && (
          <span style={{
            fontSize: 13, fontWeight: 500,
            color: testResult.ok ? 'var(--success)' : 'var(--danger)',
          }}>
            {testResult.ok ? '✓' : '✕'} {testResult.message}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────

function Toggle({ enabled, onToggle }) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: 44, height: 24, borderRadius: 99,
        background: enabled ? '#1e6fbf' : 'var(--color-border-secondary)',
        border: 'none', cursor: 'pointer',
        position: 'relative', flexShrink: 0,
        transition: 'background .2s',
      }}
    >
      <span style={{
        position: 'absolute',
        top: 3, left: enabled ? 23 : 3,
        width: 18, height: 18,
        borderRadius: '50%',
        background: '#fff',
        transition: 'left .2s',
        boxShadow: '0 1px 3px rgba(0,0,0,.2)',
      }} />
    </button>
  )
}

function HowTo({ steps }) {
  return (
    <div style={styles.howto}>
      <div style={styles.howtoTitle}>How to set up</div>
      {steps.map((s, i) => (
        <div key={i} style={styles.howtoStep}>
          <span style={styles.howtoNum}>{i + 1}</span>
          <span>{s}</span>
        </div>
      ))}
    </div>
  )
}

function DiscordIcon() {
  return <span style={{ fontSize: 16, marginRight: 6 }}>💬</span>
}
function EmailIcon() {
  return <span style={{ fontSize: 16, marginRight: 6 }}>📧</span>
}
function NtfyIcon() {
  return <span style={{ fontSize: 16, marginRight: 6 }}>🔔</span>
}

const styles = {
  infoBox: {
    background: '#eff6ff',
    border: '0.5px solid #93c5fd',
    borderRadius: 'var(--border-radius-md)',
    padding: '12px 16px',
    fontSize: 13,
    color: '#1e40af',
    marginBottom: 24,
    lineHeight: 1.6,
  },
  code: {
    fontFamily: 'var(--font-mono)',
    fontSize: 12,
    background: '#dbeafe',
    padding: '1px 5px',
    borderRadius: 4,
  },
  channelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  channelTitle: {
    fontSize: 15,
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    display: 'flex',
    alignItems: 'center',
    marginBottom: 3,
  },
  channelSub: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
  },
  howto: {
    marginTop: 14,
    padding: '12px 14px',
    background: 'var(--color-background-secondary)',
    borderRadius: 'var(--border-radius-md)',
  },
  howtoTitle: {
    fontSize: 11,
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '.8px',
    color: 'var(--color-text-secondary)',
    marginBottom: 8,
  },
  howtoStep: {
    display: 'flex',
    gap: 10,
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    marginBottom: 5,
    lineHeight: 1.5,
  },
  howtoNum: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    background: '#dbeafe',
    color: '#1e40af',
    fontSize: 10,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
}
