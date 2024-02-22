module.exports = {
  clearMocks: true,
  testTimeout: 30000,
  moduleFileExtensions: ['ts', 'js'],

  testPathIgnorePatterns: ['/.yalc/', '/data/', '/_helpers'],

  testEnvironment: 'node',

  transform: {
    '^.+\\.(ts|js)$': 'ts-jest'
  },

  silent: true
};
