import { describe, expect, it, jest } from "@jest/globals"
import type { Job, JobState } from "bullmq"

import { getJobState } from "../core/getJobState"
import type { IJobData } from "@infrastructure/jobs/types/IJobData"
import { JOB_CANCELLED_RESULT } from "@infrastructure/jobs/static/JOB_CANCELLED_RESULT"
import { DICTIONARY } from "@shared/static/DICTIONARY"

describe("getJobState", () => {
  it.each<{
    state: JobState
    cancellationState: IJobData["cancellationState"]
    result: string
    expected: string
  }>([
    {
      state: "failed",
      cancellationState: "none",
      result: "",
      expected: "failed",
    },
    {
      state: "failed",
      cancellationState: "cancelled",
      result: JOB_CANCELLED_RESULT,
      expected: "failed",
    },
    {
      state: "completed",
      cancellationState: "none",
      result: JOB_CANCELLED_RESULT,
      expected: "completed",
    },
    {
      state: "completed",
      cancellationState: "cancelling",
      result: JOB_CANCELLED_RESULT,
      expected: "cancelled",
    },
    {
      state: "completed",
      cancellationState: "cancelled",
      result: JOB_CANCELLED_RESULT,
      expected: "cancelled",
    },
    {
      state: "completed",
      cancellationState: "cancelling",
      result: "success",
      expected: "completed",
    },
    {
      state: "active",
      cancellationState: "none",
      result: "",
      expected: "running",
    },
    {
      state: "active",
      cancellationState: "cancelling",
      result: "",
      expected: "cancelling",
    },
    {
      state: "active",
      cancellationState: "cancelled",
      result: "",
      expected: "cancelling",
    },
  ])(
    "преобразует $state с отменой $cancellationState и результатом $result в $expected",
    async ({ state, cancellationState, result, expected }) => {
      const job = {
        getState: jest.fn<Job["getState"]>().mockResolvedValue(state),
        returnvalue: result,
      } as unknown as Job
      const data: IJobData = {
        name: "sync",
        version: 1,
        payload: null,
        retryDelays: [],
        cancellationState,
      }

      await expect(getJobState(job, data)).resolves.toBe(expected)
    },
  )

  it.each<JobState>(["waiting", "delayed", "prioritized", "waiting-children"])(
    "учитывает отмену задачи в состоянии %s",
    async (state) => {
      const job = {
        getState: jest.fn<Job["getState"]>().mockResolvedValue(state),
      } as unknown as Job
      const data: IJobData = {
        name: "sync",
        version: 1,
        payload: null,
        retryDelays: [],
        cancellationState: "none",
      }

      await expect(getJobState(job, data)).resolves.toBe("queued")
      await expect(
        getJobState(job, { ...data, cancellationState: "cancelling" }),
      ).resolves.toBe("cancelling")
      await expect(
        getJobState(job, { ...data, cancellationState: "cancelled" }),
      ).resolves.toBe("cancelled")
    },
  )

  it("отклоняет неизвестное состояние BullMQ", async () => {
    const job = {
      getState: jest.fn<Job["getState"]>().mockResolvedValue("unknown"),
    } as unknown as Job
    const data: IJobData = {
      name: "sync",
      version: 1,
      payload: null,
      retryDelays: [],
      cancellationState: "none",
    }

    await expect(getJobState(job, data)).rejects.toThrow(
      DICTIONARY.jobs.unsupportedState("unknown"),
    )
  })

  it("передаёт ошибку получения состояния вызывающему коду", async () => {
    const error = new Error("unavailable")
    const job = {
      getState: jest.fn<Job["getState"]>().mockRejectedValue(error),
    } as unknown as Job
    const data: IJobData = {
      name: "sync",
      version: 1,
      payload: null,
      retryDelays: [],
      cancellationState: "none",
    }

    await expect(getJobState(job, data)).rejects.toBe(error)
  })
})
