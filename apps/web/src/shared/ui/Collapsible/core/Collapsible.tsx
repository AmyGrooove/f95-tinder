import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible'
import { cn } from '@shared/functions/utility/cn'
import { useCollapsible } from './useCollapsible'
import st from './Collapsible.module.scss'
import type { ICollapsibleProps } from '../types/ICollapsibleProps'

const Collapsible = (props: ICollapsibleProps) => {
  const { children, className, isMounted, isPanelOpen, onTransitionEnd } =
    useCollapsible(props)

  if (!isMounted) {
    return null
  }

  return (
    <CollapsiblePrimitive.Root
      className={cn(st.root, className)}
      open={isPanelOpen}
    >
      <CollapsiblePrimitive.Panel
        className={st.panel}
        onTransitionEnd={onTransitionEnd}
      >
        {children}
      </CollapsiblePrimitive.Panel>
    </CollapsiblePrimitive.Root>
  )
}

export { Collapsible }
