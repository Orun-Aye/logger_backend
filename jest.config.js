const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/?(*.)+(spec|test).ts"],
  transform: {
    ...tsJestTransformCfg,
  },
  moduleFileExtensions: ["ts", "js", "json"],
  setupFilesAfterEnv: ["<rootDir>/src/__tests__/setup.ts"],
  collectCoverageFrom: [
    "src/**/*.{ts,js}",
    "!src/**/index.ts",
    "!src/types/**",
    "!src/**/*.d.ts",
    "!src/__tests__/**",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "text-summary", "lcov"],
  testTimeout: 30000,
  verbose: true,
  // Handle ESM packages that Jest can't parse
  transformIgnorePatterns: [
    "node_modules/(?!(@scure|otplib|@otplib)/)",
  ],
};
