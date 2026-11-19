import { describe, expect, it, jest } from "@jest/globals"
import { type DiscoveryService, DiscoveryModule } from "@nestjs/core"
import { DICTIONARY } from "@shared/static/DICTIONARY"
import { JobHandler } from "../../../decorators/JobHandler"
import { defineJob } from "../../../functions/defineJob"
import { JobRegistryService } from "../core/jobRegistry.service"
import { Test } from "@nestjs/testing"

if (Reflect.get(globalThis, "IS_INTEGRATION_TEST") === true) {
  const { createJobsTestContext } =
    await import("../../../__tests__/setup/createJobsTestContext")

  describe("JobRegistryService", () => {
    const jobsContext = createJobsTestContext()

    describe("JobRegistryService", () => {
      it("обнаруживает провайдер по декоратору при инициализации Nest", () => {
        expect(
          jobsContext.moduleRef
            ?.get(JobRegistryService)
            .get(jobsContext.definition.name),
        ).toEqual({
          definition: jobsContext.definition,
          handler: jobsContext.moduleRef?.get(jobsContext.Handler),
        })
        expect(
          jobsContext.moduleRef?.get(JobRegistryService).get("missing"),
        ).toBeUndefined()
      })

      it("отклоняет дублирующие имена при инициализации Nest", async () => {
        @JobHandler(jobsContext.definition)
        class Duplicate extends jobsContext.Handler {}
        const duplicateModule = await Test.createTestingModule({
          imports: [DiscoveryModule],
          providers: [JobRegistryService, jobsContext.Handler, Duplicate],
        }).compile()
        try {
          await expect(duplicateModule.init()).rejects.toThrow(
            DICTIONARY.jobs.multipleHandlers(jobsContext.definition.name),
          )
        } finally {
          await duplicateModule.close()
        }
      })
    })
  })
} else {
  describe("JobRegistryService", () => {
    const definition = defineJob("test.registry")

    @JobHandler(definition)
    class Handler {
      handle() {
        return "done"
      }
    }

    const createRegistry = (providers: unknown[]) => {
      const getProviders = jest.fn().mockReturnValue(providers)
      const registry = new JobRegistryService({
        getProviders,
      } as unknown as DiscoveryService)
      return { registry, getProviders }
    }

    it("находит декорированный обработчик при первом обращении", () => {
      const handler = new Handler()
      const { registry } = createRegistry([
        { metatype: Handler, instance: handler },
      ])

      expect(registry.get(definition.name)).toEqual({ definition, handler })
    })

    it("инициализируется один раз при lifecycle и последующих обращениях", () => {
      const { registry, getProviders } = createRegistry([
        { metatype: Handler, instance: new Handler() },
      ])

      registry.onModuleInit()
      registry.onModuleInit()
      registry.get(definition.name)
      expect(getProviders).toHaveBeenCalledTimes(1)
    })

    it("пропускает провайдеры без класса или метаданных", () => {
      class Other {}
      const { registry } = createRegistry([
        { metatype: null },
        {},
        { metatype: Other, instance: new Other() },
      ])

      expect(registry.get("missing")).toBeUndefined()
    })

    it("отклоняет повторную регистрацию имени задачи", () => {
      const { registry } = createRegistry([
        { metatype: Handler, instance: new Handler() },
        { metatype: Handler, instance: new Handler() },
      ])

      expect(() => registry.onModuleInit()).toThrow(
        DICTIONARY.jobs.multipleHandlers(definition.name),
      )
    })

    it.each([null, undefined, {}, { handle: "invalid" }])(
      "отклоняет экземпляр без метода handle: %p",
      (instance) => {
        const { registry } = createRegistry([{ metatype: Handler, instance }])

        expect(() => registry.get(definition.name)).toThrow(
          DICTIONARY.jobs.handlerMethodRequired(definition.name),
        )
      },
    )
  })
}
