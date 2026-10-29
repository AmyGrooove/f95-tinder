# Web capability map

This map describes inspected source in `apps/web`; it does not establish runtime behavior or backend connectivity. Paths in topic documents are relative to those documents.

| Read when changing                                                                                      | Context                            |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| App Router pages, layouts, error screens, provider composition, package commands or build configuration | [Runtime and routes](runtime.md)   |
| HTTP requests, API errors, query caching, environment access or common data helpers                     | [Data and errors](data.md)         |
| Controls, dialogs, notifications, icons, carousels or responsive interaction                            | [Shared UI and interaction](ui.md) |
| Global styles, design tokens, Sass resources, typography or translated interface text                   | [Styles and text](styles.md)       |

## Reuse and ownership

[src/app](../src/app) owns framework entrypoints; [src/routes](../src/routes) owns their rendering and route-specific behavior. [src/providers](../src/providers) owns application-wide provider adapters. [src/shared](../src/shared) contains reusable UI, hooks, functions, errors, static values and styling resources.

[tsconfig.json](../tsconfig.json) defines aliases and [eslint.config.js](../eslint.config.js) enforces dependency direction. Consult the relevant topic before adding another HTTP wrapper, query client, modal host, toast manager, viewport observer or styling mechanism.
