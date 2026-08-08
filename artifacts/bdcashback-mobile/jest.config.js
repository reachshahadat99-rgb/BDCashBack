/** @type {import('jest').Config} */
module.exports = {
  // Use Node environment for all tests — no React Native runtime needed.
  // The auth-token-setter test mocks all native modules; the cart-mutations
  // test calls raw fetch functions with MSW intercepting HTTP.
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)'],
  // Transform TypeScript / JSX via Babel using only standard presets
  // (no babel-preset-expo / react-native, which require the native build tool).
  transform: {
    '\\.[jt]sx?$': [
      'babel-jest',
      {
        presets: [
          ['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }],
          ['@babel/preset-typescript'],
          ['@babel/preset-react', { runtime: 'automatic' }],
        ],
      },
    ],
  },
  // Transform the workspace lib package (it ships TS source)
  transformIgnorePatterns: [
    '/node_modules/(?!@workspace/api-client-react)',
  ],
  moduleNameMapper: {
    // Path alias: @/ → root of mobile package
    '^@/(.*)$': '<rootDir>/$1',
    // Workspace lib — point at its TS source
    '^@workspace/api-client-react$':
      '<rootDir>/../../lib/api-client-react/src/index.ts',
  },
};
