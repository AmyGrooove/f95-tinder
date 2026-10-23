import { Injectable, OnModuleInit } from "@nestjs/common"
import { DiscoveryService } from "@nestjs/core"

import { isFunction } from "@shared/functions/checks/isFunction"
import { isNil } from "@shared/functions/checks/isNil"
import { isObject } from "@shared/functions/checks/isObject"

import type { IJobHandlerMetadata } from "../decorators/JobHandler"
import { JOB_HANDLER_METADATA_KEY } from "../static/JOB_HANDLER_METADATA_KEY"
import type { IRegisteredJobHandler } from "../types/IRegisteredJobHandler"
import { DICTIONARY } from "@shared/static/DICTIONARY"

@Injectable()
class JobRegistryService implements OnModuleInit {
  private readonly handlers = new Map<string, IRegisteredJobHandler>()
  private isInitialized = false

  constructor(private readonly discoveryService: DiscoveryService) {}

  onModuleInit() {
    this.initialize()
  }

  get(name: string) {
    this.initialize()
    return this.handlers.get(name)
  }

  private initialize() {
    if (this.isInitialized) {
      return
    }

    for (const provider of this.discoveryService.getProviders()) {
      if (isNil(provider.metatype)) {
        continue
      }

      const metadata = Reflect.getMetadata(
        JOB_HANDLER_METADATA_KEY,
        provider.metatype,
      ) as IJobHandlerMetadata | undefined

      if (isNil(metadata)) {
        continue
      }

      const { definition } = metadata

      if (this.handlers.has(definition.name)) {
        throw new Error(DICTIONARY.jobs.multipleHandlers(definition.name))
      }

      const instance: unknown = provider.instance

      if (
        !isObject(instance) ||
        !("handle" in instance) ||
        !isFunction(instance.handle)
      ) {
        throw new Error(DICTIONARY.jobs.handlerMethodRequired(definition.name))
      }

      this.handlers.set(definition.name, {
        definition,
        handler: instance as IRegisteredJobHandler["handler"],
      })
    }

    this.isInitialized = true
  }
}

export { JobRegistryService }
