// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  // ponytail: third-party skill scripts are not project code
  { ignores: ['.agents/**'] },
)
