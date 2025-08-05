export default {
  testEnvironment: 'node',
  testMatch: [
    '**/unitTests/**/*.test.js'
  ],
  collectCoverageFrom: [
    '**/*.js',
    '!**/node_modules/**',
    '!**/unitTests/**',
    '!jest.config.js',
    '!main.js'
  ],
  verbose: true
};
