import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default tseslint.config(
    {
        ignores: [
            '**/dist/**',
            '**/cdk.out/**',
            '**/node_modules/**',
            'frontend/**',
        ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.browser,
            },
            parserOptions: {
                tsconfigRootDir: __dirname,
            },
        },
        rules: {
            'no-useless-escape': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-require-imports': 'off',
        },
    }
)
