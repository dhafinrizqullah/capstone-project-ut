import * as z from 'zod'
import en from 'zod/v4/locales/en.js'
import id from 'zod/v4/locales/id.js'

// zod's own locale maps: the floor for codes this file does not rewrite.
const builtIn = { id: id().localeError, en: en().localeError }

/**
 * Form validation speaks the active UI locale and the user's language, not
 * zod's: "Wajib diisi." instead of "Terlalu kecil: diharapkan string memiliki
 * >=1 karakter". Every schema gets this for free — a message passed to the
 * schema itself (e.g. resident.amountMin) still wins.
 *
 * Client only: the API keeps English error strings, per the repo convention.
 */
export default defineNuxtPlugin(() => {
  const { $i18n } = useNuxtApp()

  z.config({
    localeError: (issue) => {
      const t = (key: string, params?: Record<string, unknown>) => $i18n.t(key, params ?? {}) as string
      const fallback = () => builtIn[$i18n.locale.value === 'en' ? 'en' : 'id'](issue)

      switch (issue.code) {
        case 'invalid_type':
          return t('validation.required')
        case 'invalid_value':
          return t('validation.choice')
        case 'invalid_format':
          return issue.format === 'email' ? t('validation.email') : t('validation.format')
        case 'too_small':
          if (issue.origin === 'string') {
            return issue.minimum === 1 ? t('validation.required') : t('validation.tooShort', { n: issue.minimum })
          }
          return issue.minimum === 0 ? t('validation.nonNegative') : t('validation.tooSmall', { n: issue.minimum })
        default:
          return fallback()
      }
    },
  })
})
