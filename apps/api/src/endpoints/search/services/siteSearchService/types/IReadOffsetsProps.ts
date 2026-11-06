import type { ESearchGroup } from "./ESearchGroup"

interface IReadOffsetsProps {
  cursor: string | undefined
  fingerprint: string
  selected: ESearchGroup[]
  limit: number
}

export type { IReadOffsetsProps }
