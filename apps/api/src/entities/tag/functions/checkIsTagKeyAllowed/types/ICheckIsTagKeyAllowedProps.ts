import type { ETagGroup } from "../../../schemas/ETagGroup"

interface ICheckIsTagKeyAllowedProps {
  key: string
  group: ETagGroup | null
}

export type { ICheckIsTagKeyAllowedProps }
