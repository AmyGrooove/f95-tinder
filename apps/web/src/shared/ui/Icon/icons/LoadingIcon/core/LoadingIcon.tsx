import { useLoadingIcon } from './useLoadingIcon'
import type { ILoadingIconProps } from '../types/ILoadingIconProps'

const LoadingIcon = (props: ILoadingIconProps) => {
  const { className, ref, size } = useLoadingIcon(props)

  return (
    <svg
      className={className}
      fill="none"
      height={size}
      ref={ref}
      viewBox="0 0 100 100"
      width={size}
    >
      <circle
        cx="50"
        cy="50"
        r="35"
        stroke="currentColor"
        strokeDasharray="164 57"
        strokeLinecap="round"
        strokeWidth="10"
      >
        <animateTransform
          attributeName="transform"
          dur="900ms"
          repeatCount="indefinite"
          type="rotate"
          values="0 50 50;360 50 50"
        />
      </circle>
    </svg>
  )
}

export { LoadingIcon }
