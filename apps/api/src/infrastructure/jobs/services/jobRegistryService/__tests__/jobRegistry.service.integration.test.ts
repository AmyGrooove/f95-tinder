import { describe, expect, it } from "@jest/globals"
import { DiscoveryModule } from "@nestjs/core"
import { Test } from "@nestjs/testing"

import { DICTIONARY } from "@shared/static/DICTIONARY"
import { JobHandler } from "../../../decorators/JobHandler"
import { JobRegistryService } from "../core/jobRegistry.service"

import { createJobsTestContext } from "../../../__tests__/setup/createJobsTestContext"

describe("JobRegistryService Redis", () => {
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
