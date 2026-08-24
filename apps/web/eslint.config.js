import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'
import prettier from 'eslint-config-prettier/flat'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    files: ['**/*.stories.{ts,tsx}'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },
  prettier,
  globalIgnores([
    '.next/**',
    'build/**',
    'dist/**',
    'next-env.d.ts',
    'node_modules/**',
    'out/**',
    'storybook-static/**',
    'tsconfig.tsbuildinfo',
  ]),
])

export default eslintConfig
