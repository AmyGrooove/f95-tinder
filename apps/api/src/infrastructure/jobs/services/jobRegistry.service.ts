import { Injectable, OnModuleInit } from "@nestjs/common"
import { DiscoveryService } from "@nestjs/core"

import { isFunction } from "@shared/functions/checks/isFunction"
import { isNil } from "@shared/functions/checks/isNil"
import { isObject } from "@shared/functions/checks/isObject"

import { JOB_HANDLER_METADATA_KEY } from "../static/JOB_HANDLER_METADATA_KEY"
import type { IJobHandlerOptions } from "../types/IJobHandlerOptions"
import type { TJobType } from "../types/IJobPayloadMap"
import type { IRegisteredJobHandler } from "../types/IRegisteredJobHandler"
import type { IJobHandlerMetadata } from "../decorators/JobHandler/types/IJobHandlerMetadata"

@Injectable()
class JobRegistry implements OnModuleInit {
  private readonly handlers = new Map<TJobType, IRegisteredJobHandler>()

  constructor(private readonly discoveryService: DiscoveryService) {}

  onModuleInit() {
    for (const provider of this.discoveryService.getProviders()) {
      if (isNil(provider.metatype)) {
        continue
      }

      const metadata = Reflect.getMetadata(
        JOB_HANDLER_METADATA_KEY,
        provider.metatype,
      ) as IJobHandlerMetadata | undefined

      if (!isNil(metadata)) {
        this.register(metadata, provider.instance)
      }
    }
  }

  get(type: TJobType) {
    return this.handlers.get(type)
  }

  getConcurrency() {
    return [...this.handlers.values()].reduce((total, { options }) => {
      return total + options.concurrency
    }, 0)
  }

  private register(metadata: IJobHandlerMetadata, instance: unknown) {
    if (this.handlers.has(metadata.type)) {
      throw new Error(`Multiple handlers are registered for '${metadata.type}'`)
    }

    if (
      !isObject(instance) ||
      !isFunction((instance as Record<string, unknown>).handle)
    ) {
      throw new Error(`Job handler '${metadata.type}' must provide handle()`)
    }

    this.handlers.set(metadata.type, {
      handler: instance as IRegisteredJobHandler["handler"],
      options: this.normalizeOptions(metadata),
    })
  }

  private normalizeOptions(options?: IJobHandlerOptions) {
    const normalizedOptions = {
      attempts: options?.attempts ?? 3,
      retryDelay: options?.retryDelay ?? 1_000,
      concurrency: options?.concurrency ?? 1,
    }

    if (!Number.isInteger(normalizedOptions.attempts) || normalizedOptions.attempts <= 0) {
      throw new Error("Job handler option 'attempts' must be a positive integer")
    }

    if (!Number.isInteger(normalizedOptions.retryDelay) || normalizedOptions.retryDelay < 0) {
      throw new Error("Job handler option 'retryDelay' must be a non-negative integer")
    }

    if (!Number.isInteger(normalizedOptions.concurrency) || normalizedOptions.concurrency <= 0) {
      throw new Error("Job handler option 'concurrency' must be a positive integer")
    }

    return normalizedOptions
  }
}

export { JobRegistry }
