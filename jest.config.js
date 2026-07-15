require('dotenv').config();

/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/types/**',
    '!src/module.ts',
    '!src/__tests__/**',
  ],
  coverageReporters: [
    'text',          // per-file table printed to the console
    'text-summary',  // one-glance overall totals at the end of the run
    'html',          // browsable report at coverage/lcov-report/index.html
    'lcov',          // machine-readable coverage/lcov.info
    'json-summary',  // coverage/coverage-summary.json (quick/programmatic read)
    'clover',        // coverage/clover.xml (CI tooling)
  ],
  // Enforced minimums (set just below the achieved numbers so a small
  // refactor won't fail the build, while any real regression will).
  // Achieved: statements/lines/functions 100%, branches ~74%.
  coverageThreshold: {
    global: {
      statements: 98,
      lines: 98,
      functions: 100,
      branches: 70,
    },
  },
};
