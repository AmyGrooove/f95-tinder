import type { Preview } from '@storybook/nextjs-vite'

import { TooltipProvider } from '../src/providers/TooltipProvider'
import '../src/shared/styles/global.scss'
import './docs/docsBackground.css'

const preview: Preview = {
  globalTypes: {
    colorTheme: {
      description: 'Color theme',
      toolbar: {
        icon: 'paintbrush',
        items: [
          { value: 'default', title: 'Default' },
          { value: 'bisky', title: 'Bisky' },
        ],
      },
    },
  },
  initialGlobals: {
    colorTheme: 'default',
  },
  decorators: [
    (Story, context) => {
      if (context.globals.colorTheme === 'default') {
        delete document.documentElement.dataset.colorTheme
      } else {
        document.documentElement.dataset.colorTheme = context.globals.colorTheme
      }

      return (
        <TooltipProvider>
          <svg style={{ display: 'none' }}>
            <filter
              id="glass-distortion"
              x="0%"
              y="0%"
              width="100%"
              height="100%"
              filterUnits="objectBoundingBox"
            >
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.01 0.01"
                numOctaves="1"
                seed="5"
                result="turbulence"
              />
              <feComponentTransfer in="turbulence" result="mapped">
                <feFuncR
                  type="gamma"
                  amplitude="1"
                  exponent="10"
                  offset="0.5"
                />
                <feFuncG type="gamma" amplitude="0" exponent="1" offset="0" />
                <feFuncB type="gamma" amplitude="0" exponent="1" offset="0.5" />
              </feComponentTransfer>
              <feGaussianBlur
                in="turbulence"
                stdDeviation="3"
                result="softMap"
              />
              <feSpecularLighting
                in="softMap"
                surfaceScale="5"
                specularConstant="1"
                specularExponent="100"
                lightingColor="white"
                result="specLight"
              >
                <fePointLight x="-200" y="-200" z="300" />
              </feSpecularLighting>
              <feComposite
                in="specLight"
                operator="arithmetic"
                k1="0"
                k2="1"
                k3="1"
                k4="0"
                result="litImage"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="softMap"
                scale="150"
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          </svg>
          <Story />
        </TooltipProvider>
      )
    },
  ],
  parameters: {
    backgrounds: {
      default: 'dark',
      values: [
        {
          name: 'dark',
          value: 'var(--color-dark-strong)',
        },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
}

export default preview
