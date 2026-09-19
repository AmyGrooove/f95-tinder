import type { createInfrastructureConfiguration } from "../functions/createInfrastructureConfiguration"

type TInfrastructureConfiguration = ReturnType<
  typeof createInfrastructureConfiguration
>

export type { TInfrastructureConfiguration }
