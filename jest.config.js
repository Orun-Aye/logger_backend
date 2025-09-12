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
  setupFiles: ["dotenv/config"],
  collectCoverageFrom: [
    "src/**/*.{ts,js}",
    "!src/**/index.ts",
    "!src/types/**",
    "!src/**/*.d.ts",
  ],
  coverageDirectory: "coverage",
};