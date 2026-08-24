import { addons } from 'storybook/manager-api'
import { create } from 'storybook/theming'

const storybookTheme = create({
  base: 'dark',
  colorPrimary: '#5b4ff5',
  colorSecondary: '#5b4ff5',
  appBg: '#0b121d',
  appContentBg: '#1b222e',
  appHoverBg: '#2b3340',
  appPreviewBg: '#0b121d',
  appBorderColor: '#2b3340',
  textColor: '#eff6ff',
  textInverseColor: '#eff6ff',
  textMutedColor: '#cbd1db',
  barTextColor: '#eff6ff',
  barHoverColor: '#eff6ff',
  barSelectedColor: '#5b4ff5',
  barBg: '#1b222e',
  buttonBg: '#1b222e',
  buttonBorder: '#2b3340',
  booleanBg: '#1b222e',
  booleanSelectedBg: '#5b4ff5',
  inputBg: '#1b222e',
  inputBorder: '#2b3340',
  inputTextColor: '#eff6ff',
})

addons.setConfig({ theme: storybookTheme })
