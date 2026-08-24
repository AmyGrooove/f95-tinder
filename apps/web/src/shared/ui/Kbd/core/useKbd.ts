import type { IKbdProps } from '../types/IKbdProps'

const useKbd = (props: IKbdProps) => {
  const { children, className, ref, render } = props

  return {
    children,
    className,
    ref,
    render,
  }
}

export { useKbd }
