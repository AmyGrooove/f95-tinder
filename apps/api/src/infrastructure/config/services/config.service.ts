import { Inject, Injectable } from "@nestjs/common"

import { infrastructureConfiguration } from "../config.module"
import type { TInfrastructureConfiguration } from "../types/TInfrastructureConfiguration"

@Injectable()
class InfrastructureConfigService {
  constructor(
    @Inject(infrastructureConfiguration.KEY)
    private readonly configuration: TInfrastructureConfiguration,
  ) {}

  get app(): TInfrastructureConfiguration["app"] {
    return this.configuration.app
  }

  get database(): TInfrastructureConfiguration["database"] {
    return this.configuration.database
  }

  get redis(): TInfrastructureConfiguration["redis"] {
    return this.configuration.redis
  }

  get jwt(): TInfrastructureConfiguration["jwt"] {
    return this.configuration.jwt
  }

  get storage(): TInfrastructureConfiguration["storage"] {
    return this.configuration.storage
  }

  get search(): TInfrastructureConfiguration["search"] {
    return this.configuration.search
  }

  get mail(): TInfrastructureConfiguration["mail"] {
    return this.configuration.mail
  }
}

export { InfrastructureConfigService }
