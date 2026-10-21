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
      setupFilesAfterEnv: ["<rootDir>/src/tests/setup/setupIntegration.ts"],
    },
  ],
  testTimeout: 30_000,
}
