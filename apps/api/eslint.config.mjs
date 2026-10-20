import eslint from "@eslint/js"
import prettier from "eslint-config-prettier"
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript"
import importX from "eslint-plugin-import-x"
import globals from "globals"
import typescriptEslint from "typescript-eslint"
import { amy } from "../../eslint/amy.mjs"

const LAYERS = ["app", "endpoints", "entities", "infrastructure", "shared"]

const NAMING_CONVENTION = [
  { selector: "interface", format: ["PascalCase"], prefix: ["I"] },
  { selector: "typeAlias", format: ["PascalCase"], prefix: ["T"] },
  {
    selector: [
      "variable",
      "parameter",
      "parameterProperty",
      "classProperty",
      "typeProperty",
    ],
    types: ["boolean"],
    format: ["PascalCase"],
    prefix: ["is"],
    filter: { regex: "^[A-Z][A-Z0-9_]*$", match: false },
  },
  {
    selector: ["classProperty", "typeProperty"],
    modifiers: ["requiresQuotes"],
    format: null,
  },
  {
    selector: "classProperty",
    modifiers: ["override"],
    format: null,
  },
]

const EXTERNAL_BOOLEAN_PROPERTIES = [
  {
    file: "src/infrastructure/database/services/mongoBulk.repository.ts",
    properties: ["rawResult", "lean"],
  },
  {
    file: "src/infrastructure/jobs/types/IJobAddOptions.ts",
    properties: ["extend", "replace", "keepLastIfActive"],
  },
]

export default [
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  eslint.configs.recommended,
  ...typescriptEslint.configs.recommended,
  prettier,
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ["src/**/*.ts"],
    plugins: {
      "import-x": importX,
      amy,
    },
    settings: {
      "import-x/resolver-next": [
        createTypeScriptImportResolver({
          project: `${import.meta.dirname}/tsconfig.json`,
        }),
      ],
    },
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "prefer-const": "error",
      curly: ["error", "all"],
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportSpecifier[exportKind='type']",
          message: "Use a separate export type declaration",
        },
        {
          selector: "ExportAllDeclaration",
          message: "Export public objects explicitly",
        },
        {
          selector:
            "CallExpression[callee.type=/^(ArrowFunctionExpression|FunctionExpression)$/]",
          message: "Do not use IIFEs",
        },
      ],
      "import-x/no-default-export": "error",
      "import-x/no-cycle": ["error", { ignoreExternal: true }],
      "import-x/no-self-import": "error",
      "amy/file-objects": "error",
      "import-x/no-restricted-paths": [
        "error",
        {
          basePath: import.meta.dirname,
          zones: LAYERS.slice(1).map((layer, index) => ({
            target: `./src/${layer}`,
            from: LAYERS.slice(0, index + 1).map(
              (higherLayer) => `./src/${higherLayer}`,
            ),
            message: "Do not import from a higher application layer",
          })),
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/consistent-type-definitions": ["error", "interface"],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      "@typescript-eslint/consistent-type-exports": [
        "error",
        { fixMixedExportsWithInlineTypeSpecifier: false },
      ],
      "@typescript-eslint/naming-convention": [
        "error",
        ...NAMING_CONVENTION,
      ],
      "@typescript-eslint/strict-boolean-expressions": [
        "error",
        {
          allowNullableObject: false,
          allowNumber: false,
          allowString: false,
        },
      ],
    },
  },
  ...EXTERNAL_BOOLEAN_PROPERTIES.map(({ file, properties }) => ({
    files: [file],
    rules: {
      "@typescript-eslint/naming-convention": [
        "error",
        ...NAMING_CONVENTION,
        {
          selector: "typeProperty",
          types: ["boolean"],
          filter: { regex: `^(${properties.join("|")})$`, match: true },
          format: null,
        },
      ],
    },
  })),
]
