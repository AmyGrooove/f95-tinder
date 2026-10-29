# Web agent context

This package is `@bisky/web`, the Bisky frontend built with Next.js App Router, React and TypeScript. Start at [the capability map](agents/index.md), then inspect the linked production sources for the affected task.

## Orientation

- [App Router entrypoints](src/app) delegate rendering to [route components](src/routes). The current `/` page renders an empty `MainPage`; dictionary entries alone do not establish implemented product pages.
- [AppProviders](src/routes/layout/RootLayout/core/AppProviders/core/AppProviders.tsx) composes tooltips, TanStack Query, toasts and dialogs. Reuse these providers and the [shared UI](src/shared/ui) before introducing another mechanism.
- [fetchData](src/shared/functions/api/fetchData) is the existing JSON HTTP helper. Read [data and errors](agents/data.md) before connecting API consumers or changing environment handling.
- The source currently has `app`, `routes`, `providers` and `shared`. The `@entities/*` alias is configured, but there is no current `src/entities` directory. Follow the actual source and configured dependency boundaries when extending the application.

## Working boundaries

- Preserve unrelated changes and existing public contracts. Do not commit unless requested.
- Run package commands from `apps/web`; inspect [package.json](package.json) for current scripts and dependencies. Formatting and lint scripts ending in `:fix`, and `format`, mutate files; use targeted checks for scoped work.
- [ESLint](eslint.config.js) enforces layer direction, object structure and component hooks through local Amy rules. Read [runtime context](agents/runtime.md) for entrypoint exceptions and tooling.
- Reuse public `index.ts` entrypoints, existing checks, UI components, dictionary values and Sass resources where suitable. Inspect each object's actual props and exports before using it.
- Test, fixture and snapshot edits require an explicit request or accepted offer. Running, creating or modifying Storybook requires explicit authorization. Do not expose environment secrets.
- Keep agent context in English. Update affected existing context when documented contracts change; verify claims against current production code.
