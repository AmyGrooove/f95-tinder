import { createDefaultEsmPreset } from "ts-jest"

const common = {
  ...createDefaultEsmPreset({ tsconfig: "<rootDir>/tsconfig.test.json" }),
  rootDir: import.meta.dirname,
  testEnvironment: "node",
  setupFiles: ["<rootDir>/src/app/__tests__/setup/setupEnvironment.ts"],
  moduleNameMapper: {
    "^@entities/(.*)$": "<rootDir>/src/entities/$1",
    "^@endpoints/(.*)$": "<rootDir>/src/endpoints/$1",
    "^@infrastructure/(.*)$": "<rootDir>/src/infrastructure/$1",
    "^@shared/(.*)$": "<rootDir>/src/shared/$1",
    "^@app/(.*)$": "<rootDir>/src/app/$1",
  },
  clearMocks: true,
  restoreMocks: true,
}

export default {
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/__tests__/**",
    "!src/**/*.d.ts",
    "!src/**/types/[IT]*.ts",
  ],
  coverageProvider: "v8",
  coverageDirectory: "<rootDir>/coverage",
  coverageReporters: ["text", "html", "json-summary"],
  projects: [
    {
      ...common,
      displayName: "unit",
      testMatch: ["<rootDir>/src/**/__tests__/*.test.ts"],
      testPathIgnorePatterns: ["\\.integration\\.test\\.ts$"],
    },
    {
      ...common,
      displayName: "integration",
      testMatch: ["<rootDir>/src/**/__tests__/*.integration.test.ts"],
      globalSetup: "<rootDir>/__tests__/setupIntegration.mjs",
      globalTeardown: "<rootDir>/__tests__/teardownIntegration.mjs",
    },
  ],
  testTimeout: 30_000,
}
