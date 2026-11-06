import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"
import { Test, type TestingModule } from "@nestjs/testing"
import { JobService } from "@infrastructure/jobs/services/jobService"
import { LoggerService } from "@infrastructure/logger/services/loggerService"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"

import { TagSearchSchedulerService } from "../core/tagSearchScheduler.service"
import { SYNC_TAG_SEARCH_JOB } from "@endpoints/tag/static/SYNC_TAG_SEARCH_JOB"

describe("TagSearchSchedulerService", () => {
  const jobs = { add: jest.fn<JobService["add"]>() }
  const logger = { error: jest.fn<LoggerService["error"]>() }
  let service: TagSearchSchedulerService
  let module: TestingModule

  beforeEach(async () => {
    jest.resetAllMocks()
    module = await Test.createTestingModule({
      providers: [
        TagSearchSchedulerService,
        { provide: JobService, useValue: jobs },
        { provide: LoggerService, useValue: logger },
      ],
    }).compile()
    service = module.get(TagSearchSchedulerService)
  })

  afterEach(async () => module?.close())

  it("ставит начальную синхронизацию с дедупликацией по имени задачи", async () => {
    await service.onApplicationBootstrap()
    expect(jobs.add).toHaveBeenCalledTimes(1)
    expect(jobs.add).toHaveBeenCalledWith(SYNC_TAG_SEARCH_JOB, null, {
      deduplication: { id: SYNC_TAG_SEARCH_JOB.name },
    })
  })

  it("при ошибке очереди пишет причину в журнал и позволяет следующий запуск", async () => {
    const error = new Error("Redis unavailable")
    jobs.add.mockRejectedValueOnce(error)
    await expect(service.enqueue()).resolves.toBeUndefined()
    expect(logger.error).toHaveBeenCalledWith(
      DICTIONARY.tag.searchEnqueueFailed,
      error,
      { context: TagSearchSchedulerService.name },
    )
    await service.enqueue()
    expect(jobs.add).toHaveBeenCalledTimes(2)
    expect(logger.error).toHaveBeenCalledTimes(1)
  })
})
