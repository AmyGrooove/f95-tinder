import eslint from "@eslint/js"
import prettier from "eslint-config-prettier"
import globals from "globals"
import typescriptEslint from "typescript-eslint"

export default [
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  eslint.configs.recommended,
  ...typescriptEslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  prettier,
]
