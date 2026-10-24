import { createDefaultEsmPreset } from "ts-jest"

const common = {
  ...createDefaultEsmPreset({ tsconfig: "<rootDir>/tsconfig.test.json" }),
  rootDir: import.meta.dirname,
  testEnvironment: "node",
  setupFiles: ["<rootDir>/src/tests/setup/setupEnvironment.ts"],
  moduleNameMapper: {
    "^@entities/(.*)$": "<rootDir>/src/entities/$1",
    "^@endpoints/(.*)$": "<rootDir>/src/endpoints/$1",
    "^@infrastructure/(.*)$": "<rootDir>/src/infrastructure/$1",
    "^@shared/(.*)$": "<rootDir>/src/shared/$1",
    "^@test/(.*)$": "<rootDir>/src/tests/$1",
  },
  clearMocks: true,
  restoreMocks: true,
}

export default {
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/__tests__/**",
    "!src/tests/**",
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
      moduleNameMapper: {
        "^@infrastructure/security/functions/hashValue$":
          "<rootDir>/src/tests/functions/hashValue/index.ts",
        ...common.moduleNameMapper,
      },
      testMatch: ["<rootDir>/src/**/__tests__/*.integration.test.ts"],
      globalSetup: "<rootDir>/scripts/tests/setupIntegration.mjs",
      globalTeardown: "<rootDir>/scripts/tests/teardownIntegration.mjs",
    },
  ],
  testTimeout: 30_000,
}
