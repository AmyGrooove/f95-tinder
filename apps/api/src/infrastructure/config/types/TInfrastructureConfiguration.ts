import type { ConfigType } from "@nestjs/config"

import type { infrastructureConfiguration } from "../config.module"

type TInfrastructureConfiguration = ConfigType<
  typeof infrastructureConfiguration
>

export type { TInfrastructureConfiguration }
