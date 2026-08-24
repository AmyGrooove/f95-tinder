import { Tabs as TabsPrimitive } from '@base-ui/react/tabs'
import { cn } from '@shared/functions/utility/cn'
import { Icon } from '@shared/ui/Icon'
import { useTabs } from './useTabs'
import st from './Tabs.module.scss'
import type { ITabsProps } from '../types/ITabsProps'
import { isNil } from '@shared/functions/checks/isNil'

const Tabs = (props: ITabsProps) => {
  const { className, handleChange, items, ref, value } = useTabs(props)

  return (
    <TabsPrimitive.Root
      className={cn(st.root, className)}
      onValueChange={handleChange}
      ref={ref}
      value={value}
    >
      <TabsPrimitive.List className={st.list}>
        {items.map((tabItem) => {
          return (
            <TabsPrimitive.Tab
              className={cn(st.tab, {
                [st.tab_active]: value === tabItem.value,
                [st.tab_disabled]: tabItem.isDisabled,
              })}
              disabled={tabItem.isDisabled}
              key={tabItem.value}
              value={tabItem.value}
            >
              {!isNil(tabItem.icon) && (
                <Icon className={st.icon} name={tabItem.icon} />
              )}
              <span className={st.label}>{tabItem.label}</span>
            </TabsPrimitive.Tab>
          )
        })}
        <TabsPrimitive.Indicator className={st.indicator} />
      </TabsPrimitive.List>
    </TabsPrimitive.Root>
  )
}

export { Tabs }
