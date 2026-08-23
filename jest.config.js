/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/cartoon-engine/__tests__', '<rootDir>/src'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.engine.json' }],
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'cartoon-engine/**/*.ts',
    'src/**/*.ts',
    '!cartoon-engine/cli.ts',
    '!src/**/*.test.ts',
  ],
};

module.exports = config;
