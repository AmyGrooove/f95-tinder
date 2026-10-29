# Runtime and routes

## Entrypoints and shell

- [src/app/layout.tsx](../src/app/layout.tsx) imports global SCSS and re-exports `RootLayout`, `METADATA` and `VIEWPORT` from [RootLayout's public entrypoint](../src/routes/layout/RootLayout/index.ts).
- [RootLayout](../src/routes/layout/RootLayout/core/RootLayout.tsx) renders Russian-language HTML, the Roboto font, `GlassDistortionFilter` and `AppProviders`. The SVG filter is shared with the [liquid glass mixin](../src/shared/styles/mixins/liquidGlass.scss).
- [AppProviders](../src/routes/layout/RootLayout/core/AppProviders/core/AppProviders.tsx) is a client boundary. Its nesting is `TooltipProvider` -> `QueryProvider` -> `ToastProvider` -> `DialogProvider` -> children. Dialog and toast providers also mount their shared rendering hosts.
- [src/app/(main)/page.tsx](<../src/app/(main)/page.tsx>) delegates `/` to [MainPage](../src/routes/main/MainPage/core/MainPage.tsx), which currently returns an empty fragment. Inspect actual route files before treating a product screen as implemented.
- [Metadata](../src/routes/layout/RootLayout/static/METADATA.ts) sets the Bisky title and `/favicon.svg`; [viewport](../src/routes/layout/RootLayout/static/VIEWPORT.ts) sets device width and initial scale. [ROBOTO_FONT](../src/routes/layout/RootLayout/static/ROBOTO_FONT.ts) uses `next/font/google` with Cyrillic/Latin subsets and weights 400/700.

## Error screens

[not-found.tsx](../src/app/not-found.tsx) delegates to `NotFound`. [global-error.tsx](../src/app/global-error.tsx) is a client entrypoint delegating to [GlobalError](../src/routes/layout/GlobalError/core/GlobalError.tsx), which renders its own HTML/body. Its [hook](../src/routes/layout/GlobalError/core/useGlobalError.ts) logs the error, calls `reset()` for retry and navigates to `/` for the home action.

[Unauthorized](../src/routes/layout/Unauthorized/index.ts) and [Forbidden](../src/routes/layout/Forbidden/index.ts) are reusable route components, with no corresponding files in the current App Router tree. [useUnauthorized](../src/routes/layout/Unauthorized/core/useUnauthorized.ts) currently has an empty authorization click handler; the screen is not evidence of a connected sign-in flow.

## Tooling and boundaries

- [next.config.ts](../next.config.ts) enables standalone output, React strict mode and typed routes. [tsconfig.json](../tsconfig.json) enables strict TypeScript and aliases for routes, entities, providers and shared.
- [ESLint](../eslint.config.js) orders layers as `app`, `routes`, `entities`, `providers`, `shared`; a lower layer cannot import a higher one. The configured entities layer currently has no source directory.
- The local [Amy ESLint plugin](../eslint/amy.mjs) supplies `file-objects`, `component-hooks` and `effector-names`. Ordinary source uses named exports; framework entrypoint and story exceptions are configured explicitly. Do not infer that another file is exempt.
- [package.json](../package.json) provides `dev`, `build`, `start`, `type-check`, `storybook`, `lint:fix`, `stylelint:fix` and `format`. `type-check` runs `next typegen` before `tsc --noEmit`, so it can generate framework files. Prefer targeted `pnpm exec prettier --check <files>` for documentation-only changes.
- [Dockerfile](../Dockerfile) builds standalone output and runs `server.js` as the node user, copying static and public assets. Its healthcheck requests `/`. This describes configuration, not a verified container run.

Run commands from `apps/web` using the pnpm version specified by `packageManager`. Do not install dependencies or launch Storybook as an incidental documentation check.
