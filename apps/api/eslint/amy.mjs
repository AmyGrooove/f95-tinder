import { existsSync } from "node:fs"
import path from "node:path"

const createRule = (messages, create) => ({
  meta: { type: "suggestion", schema: [], messages },
  create,
})

const getFunctionName = (node) => {
  if (node.id?.type === "Identifier") {
    return node.id.name
  }

  if (node.parent?.type === "VariableDeclarator") {
    return node.parent.id.name
  }

  return undefined
}

const getFunction = (node) => {
  let current = node.parent

  while (current) {
    if (
      [
        "ArrowFunctionExpression",
        "FunctionExpression",
        "FunctionDeclaration",
      ].includes(current.type)
    ) {
      return current
    }

    current = current.parent
  }

  return undefined
}

const fileObjects = createRule(
  {
    constant:
      "Declare one SCREAMING_SNAKE_CASE constant per static file, matching the filename",
    filename: "The primary object filename must match its declaration",
    nest: "Use the matching Nest class suffix and lowerCamelCase role filename; DTO classes end in Dto",
  },
  (context) => {
    const filename = context.filename.replaceAll("\\", "/")
    const stem = path.basename(filename).replace(/\.[^.]+$/, "")
    const isTypes =
      filename.includes("/types/") &&
      !filename.endsWith(".d.ts") &&
      stem !== "index"
    const isStatic = filename.includes("/static/") && stem !== "index"
    const declarations = []

    return {
      VariableDeclarator(node) {
        if (
          isStatic &&
          (node.parent.parent.type === "Program" ||
            node.parent.parent.type === "ExportNamedDeclaration")
        ) {
          declarations.push(node)

          if (
            node.parent.kind !== "const" ||
            node.id.name !== stem ||
            !/^[A-Z][A-Z0-9_]*$/.test(node.id.name)
          ) {
            context.report({ node, messageId: "constant" })
          }
        }
      },
      "Program:exit"(node) {
        if (isStatic && declarations.length > 1) {
          context.report({
            node: declarations[1],
            messageId: "constant",
          })
        }

        if (
          filename.includes("/core/") &&
          !isTypes &&
          !isStatic &&
          !filename.includes("/stores/") &&
          !stem.includes(".") &&
          stem !== "index"
        ) {
          const primaryNames = node.body.flatMap((statement) => {
            const declaration =
              statement.type === "ExportNamedDeclaration" ||
              statement.type === "ExportDefaultDeclaration"
                ? statement.declaration
                : statement

            if (declaration?.type === "VariableDeclaration") {
              return declaration.declarations.map((item) => item.id.name)
            }

            return declaration?.id?.name ?? []
          })

          if (!primaryNames.includes(stem)) {
            context.report({ node, messageId: "filename" })
          }
        }
      },
      "ClassDeclaration, FunctionDeclaration"(node) {
        if (
          filename.includes("/core/") &&
          node.parent.type === "Program" &&
          node.id &&
          node.id.name !== stem
        ) {
          context.report({ node: node.id, messageId: "filename" })
        }
      },
      ClassDeclaration(node) {
        const role = stem.match(
          /^(.+)\.(service|repository|controller|module|body|query|params|response)$/,
        )

        if (!role || !node.id) {
          return
        }

        const suffix = ["body", "query", "params", "response"].includes(role[2])
          ? "Dto"
          : `${role[2][0].toUpperCase()}${role[2].slice(1)}`

        if (
          !/^[a-z][a-zA-Z0-9]*$/.test(role[1]) ||
          !node.id.name.endsWith(suffix)
        ) {
          context.report({ node: node.id, messageId: "nest" })
        }
      },
    }
  },
)

const componentHooks = createRule(
  {
    props:
      "Pass the original props object as the sole argument to use<ComponentName>",
    hook: "A component with props must call its owned use<ComponentName> hook",
    return:
      "Return existing variables from the component hook; compute values before return",
    handler: "Internal JSX handlers must use handle<Name>",
  },
  (context) => {
    const filename = context.filename.replaceAll("\\", "/")
    const stem = path.basename(filename).replace(/\.[^.]+$/, "")
    const isComponent =
      filename.endsWith(".tsx") &&
      /^[A-Z]/.test(stem) &&
      filename.includes("/core/")
    const isOwnedHook =
      /^use[A-Z]/.test(stem) &&
      existsSync(path.join(path.dirname(filename), `${stem.slice(3)}.tsx`))
    const components = new Map()
    const inspectFunction = (node) => {
      if (
        isComponent &&
        getFunctionName(node) === stem &&
        node.params.length > 0
      ) {
        components.set(node, false)
      }
    }

    return {
      ArrowFunctionExpression: inspectFunction,
      FunctionDeclaration: inspectFunction,
      CallExpression(node) {
        const owner = getFunction(node)

        if (!components.has(owner) || node.callee.name !== `use${stem}`) {
          return
        }

        components.set(owner, true)
        const props = owner.params[0]

        if (
          props.type !== "Identifier" ||
          node.arguments.length !== 1 ||
          node.arguments[0].type !== "Identifier" ||
          node.arguments[0].name !== props.name
        ) {
          context.report({ node, messageId: "props" })
        }
      },
      ReturnStatement(node) {
        if (
          !isOwnedHook ||
          getFunctionName(getFunction(node) ?? {}) !== stem ||
          node.argument?.type !== "ObjectExpression"
        ) {
          return
        }

        for (const property of node.argument.properties) {
          if (
            property.type !== "Property" ||
            property.computed ||
            property.value.type !== "Identifier"
          ) {
            context.report({ node: property, messageId: "return" })
          }
        }
      },
      JSXAttribute(node) {
        if (
          !isComponent ||
          !/^on[A-Z]/.test(node.name.name) ||
          node.value?.expression?.type !== "Identifier"
        ) {
          return
        }

        const name = node.value.expression.name
        let scope = context.sourceCode.getScope(node)
        let variable

        while (scope && !variable) {
          variable = scope.set.get(name)
          scope = scope.upper
        }

        if (
          variable?.defs.some(
            (definition) =>
              definition.node.type === "VariableDeclarator" &&
              ["ArrowFunctionExpression", "FunctionExpression"].includes(
                definition.node.init?.type,
              ),
          ) &&
          !/^handle[A-Z]/.test(name)
        ) {
          context.report({ node: node.value, messageId: "handler" })
        }
      },
      "Program:exit"() {
        for (const [node, hasHook] of components) {
          if (!hasHook) {
            context.report({ node, messageId: "hook" })
          }
        }
      },
    }
  },
)

const effectorNames = createRule(
  {
    store: "Effector stores must start with $",
    effect: "Effector effects must end with Fx",
  },
  (context) => {
    const factories = new Map()
    const namespaces = new Set()

    return {
      ImportDeclaration(node) {
        if (node.source.value !== "effector") {
          return
        }

        for (const specifier of node.specifiers) {
          if (specifier.type === "ImportSpecifier") {
            factories.set(specifier.local.name, specifier.imported.name)
          } else if (specifier.type === "ImportNamespaceSpecifier") {
            namespaces.add(specifier.local.name)
          }
        }
      },
      VariableDeclarator(node) {
        if (
          node.id.type !== "Identifier" ||
          node.init?.type !== "CallExpression"
        ) {
          return
        }

        const callee = node.init.callee
        const factory =
          callee.type === "Identifier"
            ? factories.get(callee.name)
            : callee.type === "MemberExpression" &&
                namespaces.has(callee.object.name)
              ? callee.property.name
              : undefined

        if (
          ["createStore", "combine"].includes(factory) &&
          !node.id.name.startsWith("$")
        ) {
          context.report({ node: node.id, messageId: "store" })
        }

        if (
          ["createEffect", "attach"].includes(factory) &&
          !node.id.name.endsWith("Fx")
        ) {
          context.report({ node: node.id, messageId: "effect" })
        }
      },
    }
  },
)

const amy = {
  meta: { name: "eslint-plugin-amy-local", version: "1.0.0" },
  rules: {
    "file-objects": fileObjects,
    "component-hooks": componentHooks,
    "effector-names": effectorNames,
  },
}

export { amy }
