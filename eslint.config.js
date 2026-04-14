const js = require('@eslint/js');
const react = require('eslint-plugin-react');
const ts = require('typescript-eslint');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
  js.configs.recommended,
  ...ts.configs.recommended,
  prettierConfig,
  {
    files: ['src/frontend/src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    plugins: {
      react,
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
    },
  },
  {
    files: ['src/server/**/*.{ts,js}'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.server.json',
      },
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'src/frontend/dist/**'],
  },
];
