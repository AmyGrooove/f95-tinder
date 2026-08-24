import type { TPrefixGroup } from "./TPrefixGroup"

type TCreatePrefixPayload = {
  f95PrefixId: number
  name: string
  group: TPrefixGroup
  slug: string
}

export type { TCreatePrefixPayload }
