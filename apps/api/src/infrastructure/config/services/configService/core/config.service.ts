import { Inject, Injectable } from "@nestjs/common"
import { getConfigToken } from "@nestjs/config"

import type { TInfrastructureConfiguration } from "../types/TInfrastructureConfiguration"

@Injectable()
class InfrastructureConfigService {
  constructor(
    @Inject(getConfigToken("infrastructure"))
    private readonly configuration: TInfrastructureConfiguration,
  ) {}

  get app() {
    return this.configuration.app
  }

  get database() {
    return this.configuration.database
  }

  get knowledge() {
    return this.configuration.knowledge
  }

  get redis() {
    return this.configuration.redis
  }

  get jwt() {
    return this.configuration.jwt
  }

  get storage() {
    return this.configuration.storage
  }

  get search() {
    return this.configuration.search
  }

  get mail() {
    return this.configuration.mail
  }

  get sources() {
    return this.configuration.sources
  }
}

export { InfrastructureConfigService }
