import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'
import prettier from 'eslint-config-prettier/flat'
import { amy } from './eslint/amy.mjs'

const LAYERS = ['app', 'routes', 'entities', 'providers', 'shared']

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  prettier,
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { amy },
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'prefer-const': 'error',
      curly: ['error', 'all'],
      'no-restricted-syntax': [
        'error',
        {
          selector: "ExportSpecifier[exportKind='type']",
          message: 'Use a separate export type declaration',
        },
        {
          selector: 'ExportAllDeclaration',
          message: 'Export public objects explicitly',
        },
        {
          selector:
            'CallExpression[callee.type=/^(ArrowFunctionExpression|FunctionExpression)$/]',
          message: 'Do not use IIFEs',
        },
      ],
      'import/no-default-export': 'error',
      'import/no-cycle': ['error', { ignoreExternal: true }],
      'import/no-self-import': 'error',
      'amy/file-objects': 'error',
      'amy/component-hooks': 'error',
      'amy/effector-names': 'error',
      'import/no-restricted-paths': [
        'error',
        {
          basePath: import.meta.dirname,
          zones: LAYERS.slice(1).map((layer, index) => ({
            target: `./src/${layer}`,
            from: LAYERS.slice(0, index + 1).map(
              (higherLayer) => `./src/${higherLayer}`,
            ),
            message: 'Do not import from a higher application layer',
          })),
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/consistent-type-exports': [
        'error',
        { fixMixedExportsWithInlineTypeSpecifier: false },
      ],
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'interface', format: ['PascalCase'], prefix: ['I'] },
        { selector: 'typeAlias', format: ['PascalCase'], prefix: ['T'] },
        {
          selector: [
            'variable',
            'parameter',
            'parameterProperty',
            'classProperty',
            'typeProperty',
          ],
          types: ['boolean'],
          format: ['PascalCase'],
          prefix: ['is'],
          filter: { regex: '^[A-Z][A-Z0-9_]*$', match: false },
        },
        {
          selector: ['classProperty', 'typeProperty'],
          modifiers: ['requiresQuotes'],
          format: null,
        },
        {
          selector: 'classProperty',
          modifiers: ['override'],
          format: null,
        },
      ],
      '@typescript-eslint/strict-boolean-expressions': [
        'error',
        {
          allowNullableObject: false,
          allowNumber: false,
          allowString: false,
        },
      ],
    },
  },
  {
    files: ['**/*.stories.{ts,tsx}'],
    rules: {
      'import/no-default-export': 'off',
      'react-hooks/rules-of-hooks': 'off',
    },
  },
  {
    files: [
      'src/app/**/{page,layout,template,loading,error,global-error,not-found,global-not-found,default,robots,sitemap,manifest,icon,apple-icon,opengraph-image,twitter-image}.{ts,tsx}',
    ],
    rules: {
      'import/no-default-export': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    'build/**',
    'coverage/**',
    'dist/**',
    'next-env.d.ts',
    'node_modules/**',
    'out/**',
    'storybook-static/**',
    'tsconfig.tsbuildinfo',
  ]),
])

export default eslintConfig
