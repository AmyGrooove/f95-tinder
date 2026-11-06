import { describe, expect, it } from "@jest/globals"
import { Reflector } from "@nestjs/core"

import { defineJob } from "@infrastructure/jobs/functions/defineJob"
import { JOB_HANDLER_METADATA_KEY } from "@infrastructure/jobs/static/JOB_HANDLER_METADATA_KEY"
import { JobHandler } from "../core/JobHandler"

describe("JobHandler", () => {
  it("сохраняет определение задания в метаданных класса обработчика", () => {
    const definition = defineJob("test.handler", {
      version: 2,
      retryDelays: [100],
    })

    @JobHandler(definition)
    class Handler {
      async handle() {
        return { status: "done" }
      }
    }

    expect(new Reflector().get(JOB_HANDLER_METADATA_KEY, Handler)).toEqual({
      definition,
    })
  })
})
