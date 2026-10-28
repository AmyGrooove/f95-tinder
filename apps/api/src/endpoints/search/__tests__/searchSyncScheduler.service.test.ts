import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"
import { Test, type TestingModule } from "@nestjs/testing"
import { JobService } from "@infrastructure/jobs/services/job.service"
import { LoggerService } from "@infrastructure/logger/services/logger.service"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"

import { SearchSyncSchedulerService } from "../services/searchSyncScheduler.service"
import { SYNC_SEARCH_JOB } from "../static/SYNC_SEARCH_JOB"

describe("SearchSyncSchedulerService", () => {
  const jobs = { add: jest.fn<JobService["add"]>() }
  const logger = { error: jest.fn<LoggerService["error"]>() }
  let service: SearchSyncSchedulerService
  let module: TestingModule

  beforeEach(async () => {
    jest.resetAllMocks()
    module = await Test.createTestingModule({
      providers: [
        SearchSyncSchedulerService,
        { provide: JobService, useValue: jobs },
        { provide: LoggerService, useValue: logger },
      ],
    }).compile()
    service = module.get(SearchSyncSchedulerService)
  })

  afterEach(async () => module?.close())

  it("ставит начальную синхронизацию с дедупликацией по имени задачи", async () => {
    await service.onApplicationBootstrap()
    expect(jobs.add).toHaveBeenCalledTimes(1)
    expect(jobs.add).toHaveBeenCalledWith(SYNC_SEARCH_JOB, null, {
      deduplication: { id: SYNC_SEARCH_JOB.name },
    })
  })

  it("при ошибке очереди пишет причину в журнал и позволяет следующий запуск", async () => {
    const error = new Error("Redis unavailable")
    jobs.add.mockRejectedValueOnce(error)
    await expect(service.enqueue()).resolves.toBeUndefined()
    expect(logger.error).toHaveBeenCalledWith(
      DICTIONARY.search.enqueueFailed,
      error,
      { context: SearchSyncSchedulerService.name },
    )
    await service.enqueue()
    expect(jobs.add).toHaveBeenCalledTimes(2)
    expect(logger.error).toHaveBeenCalledTimes(1)
  })
})
