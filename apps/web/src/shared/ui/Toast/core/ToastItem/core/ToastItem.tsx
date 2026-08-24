import { Toast as ToastPrimitive } from '@base-ui/react/toast'
import { isNil } from '@shared/functions/checks/isNil'
import { Button } from '@shared/ui/Button'
import { Icon } from '@shared/ui/Icon'
import { useToastItem } from './useToastItem'
import st from './ToastItem.module.scss'
import type { IToastItemProps } from '../types/IToastItemProps'

const ToastItem = (props: IToastItemProps) => {
  const { actionLabel, iconName, onAction, toast } = useToastItem(props)

  return (
    <ToastPrimitive.Root className={st.root} toast={toast}>
      <ToastPrimitive.Content className={st.content}>
        {!isNil(iconName) && <Icon className={st.icon} name={iconName} />}
        <div className={st.text}>
          <ToastPrimitive.Title className={st.title} />
          <ToastPrimitive.Description className={st.description} />
        </div>
        {!isNil(actionLabel) && !isNil(onAction) && (
          <ToastPrimitive.Action
            onClick={onAction}
            render={
              <Button size="small" variant="outlined">
                {actionLabel}
              </Button>
            }
          >
            {actionLabel}
          </ToastPrimitive.Action>
        )}
        <div className={st.closeButton}>
          <ToastPrimitive.Close
            render={
              <Button variant="ghost">
                <Icon name="x" />
              </Button>
            }
          />
        </div>
      </ToastPrimitive.Content>
    </ToastPrimitive.Root>
  )
}

export { ToastItem }
