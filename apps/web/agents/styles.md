# Styles and text

## Global resources

[src/app/layout.tsx](../src/app/layout.tsx) imports [global.scss](../src/shared/styles/global.scss). The global sheet loads the reset, extends color and radius placeholders on body, and establishes the dark background, light foreground, Roboto font and hidden horizontal overflow.

- [colors.scss](../src/shared/styles/variables/colors.scss) owns color custom properties.
- [borderRadiuses.scss](../src/shared/styles/variables/borderRadiuses.scss) owns border-radius custom properties.
- [reusable.scss](../src/shared/styles/reusable.scss) forwards `colorAlpha` and the interactive, liquidGlass, shimmer, transition, textStyle and fadeScaleIn mixins. Reuse their actual signatures instead of copying effects into another file.
- [liquidGlass.scss](../src/shared/styles/mixins/liquidGlass.scss) works with the root [GlassDistortionFilter](../src/routes/layout/RootLayout/core/GlassDistortionFilter/core/GlassDistortionFilter.tsx); changes to the filter identifier or effect need both sources checked.

Components use owned `*.module.scss` styles. For an existing example of class variants and shared composition, inspect [Box.module.scss](../src/shared/ui/Box/core/Box.module.scss) with [Box](../src/shared/ui/Box/core/Box.tsx), and reuse [cn](../src/shared/functions/utility/cn/index.ts) for conditional classes.

[stylelint.config.mjs](../stylelint.config.mjs) extends standard SCSS rules with project exceptions. [Prettier configuration](../.prettierrc.json) establishes the package format. Run scoped checks instead of broad fix commands for unrelated styling or documentation changes.

## Typography and interface text

[ROBOTO_FONT](../src/routes/layout/RootLayout/static/ROBOTO_FONT.ts) configures the root font; [Text](../src/shared/ui/Text/index.ts) is the shared typography entrypoint. Inspect its props and the [textStyle mixin](../src/shared/styles/mixins/textStyle.scss) before introducing a parallel typography API.

[DICTIONARY](../src/shared/static/DICTIONARY.ts) stores Russian interface strings for common date fallback and page labels/errors. Route error screens and [formatDateLabel](../src/shared/functions/format/formatDateLabel/core/formatDateLabel.ts) consume it. Keep reusable interface text with the existing dictionary where appropriate. Labels for library, settings and swipe do not mean those pages are connected in [src/app](../src/app).
