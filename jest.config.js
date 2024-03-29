module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  setupFiles: ['jest-plugin-context/setup'],
  moduleFileExtensions: ['js', 'ts'],
  coverageReporters: ['clover', 'json', 'lcov', 'text', 'text-summary'],
  collectCoverage: true,
  testResultsProcessor: 'jest-sonar-reporter',
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  testMatch: ['**/*.test.ts'],
};
