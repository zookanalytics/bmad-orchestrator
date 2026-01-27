import eslint from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import perfectionist from 'eslint-plugin-perfectionist';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  prettierConfig,
  {
    plugins: {
      perfectionist,
    },
    rules: {
      'perfectionist/sort-imports': 'error',
      'no-warning-comments': ['error', { terms: ['todo', 'fixme'] }],
      complexity: ['error', 20],
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'packages/**/dist/**'],
  }
);
