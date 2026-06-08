import React, { createContext, useContext, useState } from 'react'
import sv from './sv'
import en from './en'

const LANGS = { sv, en }

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(
    () => localStorage.getItem('kiln_lang') || 'sv'
  )

  function setLanguage(code) {
    localStorage.setItem('kiln_lang', code)
    setLang(code)
  }

  // t('key') — looks up translation, falls back to English, then the key itself
  function t(key) {
    const dict = LANGS[lang] || LANGS.sv
    return dict[key] ?? LANGS.en[key] ?? key
  }

  return (
    <LanguageContext.Provider value={{ lang, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLang() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLang must be used inside LanguageProvider')
  return ctx
}
