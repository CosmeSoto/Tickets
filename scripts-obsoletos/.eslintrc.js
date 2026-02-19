module.exports = {
  extends: ['next/core-web-vitals'],
  rules: {
    // Reglas básicas de calidad
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-debugger': 'error',
    'no-var': 'error',
    'prefer-const': 'error',

    // Reglas de React
    'react/no-unescaped-entities': 'off',
    'react/display-name': 'off',
    'react-hooks/exhaustive-deps': 'warn',
  },
  overrides: [
    {
      files: ['scripts/**/*.js', 'scripts/**/*.ts', '*.js', 'prisma/**/*.ts'],
      rules: {
        'no-console': 'off',
      },
    },
  ],
  ignorePatterns: [
    '.next/**',
    'node_modules/**',
    'out/**',
    'build/**',
    '*.config.js',
    '*.config.ts',
  ],
}
