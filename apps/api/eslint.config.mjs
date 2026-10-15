import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'drizzle/**', 'coverage/**', '*.config.*'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
      'no-restricted-syntax': [
        'error',
        {
          selector: "Literal[raw=/^\\d+\\.\\d+$/][parent.type='Property'][parent.key.name=/Halalas$/]",
          message: 'Money must be integer halalas (AI_RULES.md).',
        },
      ],
    },
  },
);
