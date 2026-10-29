# Shared UI and interaction

## Reusable controls

[shared/ui](../src/shared/ui) exposes object-level `index.ts` entrypoints. Implementations generally live in `core/`, props in `types/`, and behavior in component-owned `use<Component>` hooks. Read the owning interface before passing native DOM props: these wrappers expose selected APIs.

| Need                      | Existing entrypoints                                                                                                                                                                                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout and text           | [Box](../src/shared/ui/Box/index.ts), [Text](../src/shared/ui/Text/index.ts), [Separator](../src/shared/ui/Separator/index.ts)                                                                                                                             |
| Actions and labels        | [Button](../src/shared/ui/Button/index.ts), [Badge](../src/shared/ui/Badge/index.ts), [Kbd](../src/shared/ui/Kbd/index.ts)                                                                                                                                 |
| Text and numeric input    | [Input](../src/shared/ui/Input/index.ts), [NumberInput](../src/shared/ui/Input/hocs/NumberInput/index.ts), [Textarea](../src/shared/ui/Textarea/index.ts)                                                                                                  |
| Choice controls           | [Select](../src/shared/ui/Select/index.ts), [CheckboxGroup](../src/shared/ui/CheckboxGroup/index.ts), [RadioGroup](../src/shared/ui/RadioGroup/index.ts), [ToggleGroup](../src/shared/ui/ToggleGroup/index.ts), [Switch](../src/shared/ui/Switch/index.ts) |
| Navigation and disclosure | [Tabs](../src/shared/ui/Tabs/index.ts), [Pagination](../src/shared/ui/Pagination/index.ts), [Collapsible](../src/shared/ui/Collapsible/index.ts), [Dropdown](../src/shared/ui/Dropdown/index.ts), [Tooltip](../src/shared/ui/Tooltip/index.ts)             |
| Media and loading         | [Attachment](../src/shared/ui/Attachment/index.ts), [Carousel](../src/shared/ui/Carousel/index.ts), [Skeleton](../src/shared/ui/Skeleton/index.ts), [Progress](../src/shared/ui/Progress/index.ts), [Slider](../src/shared/ui/Slider/index.ts)             |

Many controls adapt Base UI primitives. For example, [Box](../src/shared/ui/Box/core/Box.tsx) and Text use the `render` composition API; [Button](../src/shared/ui/Button/core/Button.tsx) disables interaction when either `isDisabled` or `isLoading` is true. [Select props](../src/shared/ui/Select/types/ISelectProps.ts) use controlled `string | null` values; [NumberInput props](../src/shared/ui/Input/hocs/NumberInput/types/INumberInputProps.ts) use `number | null`.

## Dialog lifecycle

Import `setDialog({ content, title })` and `closeDialog()` from [Dialog](../src/shared/ui/Dialog/index.ts). [DialogProvider](../src/providers/DialogProvider/core/DialogProvider.tsx) already mounts the shared host.

The [Effector store](../src/shared/ui/Dialog/stores/dialogStore.ts) holds one dialog. Closing changes `isOpen` while retaining content for the exit transition; clearing resets content only if the store remains closed. [useDialog](../src/shared/ui/Dialog/core/useDialog.ts) selects mobile or desktop presentation and pins that viewport type during the open/close cycle. Preserve this lifecycle when changing animations or adding consumers.

## Notifications

Import `showToast`, `updateToast`, `closeToast` and `showPromiseToast` from [Toast](../src/shared/ui/Toast/index.ts). These functions share [TOAST_MANAGER](../src/shared/ui/Toast/static/TOAST_MANAGER.ts) with [ToastProvider](../src/providers/ToastProvider/core/ToastProvider.tsx), which configures a limit of three and a default timeout of 5000 ms. Toast creation/update uses [type-specific timeouts](../src/shared/ui/Toast/static/TOAST_TYPE_TIMEOUTS.ts). `showPromiseToast` maps loading/success/error content through the same manager.

## Icons and responsive behavior

- [Icon](../src/shared/ui/Icon/index.ts) resolves names through [ICON_COMPONENTS](../src/shared/ui/Icon/static/ICON_COMPONENTS.ts), including Lucide icons and the custom LoadingIcon. Extend this existing map and its derived types when adding names.
- [useViewportType](../src/shared/hooks/useViewportType/index.ts) uses `useSyncExternalStore`, a `(max-width: 767px)` media query and a desktop server snapshot. Dialog presentation consumes this helper.
- [useMergeRefs](../src/shared/hooks/useMergeRefs/index.ts) wraps Floating UI ref composition.
- [useCarousel](../src/shared/ui/Carousel/core/useCarousel.ts) owns Embla setup, navigation state and event cleanup. Its owned hooks coordinate auto-scroll with hover, focus, dragging and reduced-motion state. Reuse the carousel before adding another slider implementation.

Component-owned stories exist under `stories/`; running or editing them requires explicit authorization. Their presence alone is not runtime verification.
