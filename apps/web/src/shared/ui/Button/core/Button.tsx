import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cn } from '@shared/functions/utility/cn'
import { Icon } from '@shared/ui/Icon'
import { useButton } from './useButton'
import st from './Button.module.scss'
import type { IButtonProps } from '../types/IButtonProps'

const Button = (props: IButtonProps) => {
  const {
    children,
    className,
    isDisabled,
    isIconOnly,
    isLoading,
    onClick,
    ref,
    size,
    variant,
  } = useButton(props)

  return (
    <ButtonPrimitive
      className={cn(
        st.root,
        st[`root_size_${size}`],
        st[`root_variant_${variant}`],
        className,
        {
          [st.root_disabled]: isDisabled,
          [st.root_iconOnly]: isIconOnly,
          [st.root_loading]: isLoading,
        },
      )}
      disabled={isDisabled || isLoading}
      onClick={onClick}
      ref={ref}
    >
      <span className={st.content}>{children}</span>
      {isLoading && (
        <span className={st.loadingIcon}>
          <Icon name="loading" />
        </span>
      )}
    </ButtonPrimitive>
  )
}

export { Button }
