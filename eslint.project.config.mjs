// Project code style and quality rules, run by `npm run lint` after `n8n-node lint`.
// The n8n rules stay in `eslint.config.mjs`: in strict mode `n8n-node lint` requires that file unchanged.
// Tests are `.cts` because the n8n rules match only `**/*.ts` and forbid the `node:` imports tests need.

import jsdoc from 'eslint-plugin-jsdoc'
import jsonc from 'eslint-plugin-jsonc'
import security from 'eslint-plugin-security'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import neostandard from 'neostandard'

const codeFiles = ['**/*.{js,cjs,mjs,ts,cts}']
const tsFiles = ['**/*.{ts,cts}']
// Read and write paths built from their own input; the n8n config also lints these files,
// so an inline `eslint-disable` of a rule it does not define fails there
const fsPathFiles = ['test/**/*.cts', '**/*.cjs']

export default [
  {
    // `eslint.config.mjs` is n8n's file: its strict mode check compares the text
    ignores: ['dist/', 'coverage/', 'package-lock.json', 'eslint.config.mjs']
  },

  ...neostandard({ts: true, noJsx: true, filesTs: ['**/*.cts']}),

  {
    files: codeFiles,
    plugins: {
      jsdoc,
      security,
      'simple-import-sort': simpleImportSort
    },
    settings: {
      jsdoc: {mode: 'typescript'}
    },
    rules: {
      '@stylistic/arrow-parens': ['error', 'as-needed'],
      '@stylistic/brace-style': ['error', '1tbs', {allowSingleLine: false}],
      '@stylistic/multiline-ternary': 'off',
      '@stylistic/object-curly-spacing': ['error', 'never'],
      '@stylistic/object-curly-newline': ['error', {
        ImportDeclaration: {multiline: true, consistent: true}
      }],
      '@stylistic/quote-props': 'off',
      curly: ['error', 'all'],
      'dot-notation': 'off',
      'no-duplicate-imports': ['error', {allowSeparateTypeImports: true}],

      'simple-import-sort/imports': ['error', {
        groups: [
          ['^\\u0000', '^node:'],
          ['^@?\\w'],
          ['^\\.\\.(?:/|$)'],
          ['^\\./']
        ]
      }],
      'simple-import-sort/exports': 'error',

      ...security.configs.recommended.rules,
      // Bracket access with an internal constant key is common and not user input
      'security/detect-object-injection': 'off',
      'security/detect-unsafe-regex': 'error',
      'security/detect-non-literal-regexp': 'error',
      'security/detect-non-literal-fs-filename': 'error',

      'jsdoc/check-alignment': 'error',
      'jsdoc/check-param-names': 'error',
      'jsdoc/check-tag-names': 'error',
      'jsdoc/no-types': 'error'
    }
  },

  {
    files: tsFiles,
    languageOptions: {
      parserOptions: {
        project: './tsconfig.test.json',
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      '@typescript-eslint/array-type': ['error', {default: 'array-simple'}],
      '@typescript-eslint/consistent-type-imports': ['error', {
        prefer: 'type-imports',
        fixStyle: 'separate-type-imports'
      }],
      '@typescript-eslint/no-floating-promises': ['error', {
        ignoreVoid: true,
        ignoreIIFE: true,
        allowForKnownSafeCalls: [{from: 'package', package: 'node:test', name: ['describe', 'it']}]
      }],
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': ['error', {checksVoidReturn: false}]
    }
  },

  {
    files: fsPathFiles,
    rules: {
      'security/detect-non-literal-fs-filename': 'off'
    }
  },

  ...jsonc.configs['flat/recommended-with-json'],

  {
    files: ['**/*.json'],
    rules: {
      'jsonc/array-bracket-spacing': ['error', 'never'],
      'jsonc/array-element-newline': ['error', 'consistent'],
      'jsonc/comma-dangle': ['error', 'never'],
      'jsonc/comma-style': ['error', 'last'],
      'jsonc/indent': ['error', 2],
      'jsonc/key-spacing': ['error', {beforeColon: false, afterColon: true}],
      'jsonc/object-curly-newline': ['error', {multiline: true, consistent: true}],
      'jsonc/object-curly-spacing': ['error', 'never'],
      'jsonc/object-property-newline': ['error', {allowAllPropertiesOnSameLine: true}],
      'jsonc/quote-props': ['error', 'always'],
      'jsonc/quotes': ['error', 'double'],
      'no-trailing-spaces': 'error'
    }
  }
]
