/* eslint-env node */
// Eigenes ESLint-Setup fuers Server-Paket (Review 12.07.2026, P3.9): Node-Umgebung statt
// Browser, keine React-Plugins — laeuft eigenstaendig im isolierten CI-Job (nur server/).
module.exports = {
  root: true,
  env: { node: true, es2021: true },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  ignorePatterns: ['dist', 'node_modules', '*.cjs'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
};
