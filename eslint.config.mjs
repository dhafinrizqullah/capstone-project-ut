// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  // ponytail: skill pihak ketiga bukan kode proyek
  { ignores: ['.agents/**'] },
)
