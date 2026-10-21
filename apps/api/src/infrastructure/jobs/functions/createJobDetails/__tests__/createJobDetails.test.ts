import { describe, expect, it } from "@jest/globals"
import type { Job } from "bullmq"

import { createJobDetails } from "../core/createJobDetails"
import type { TJobState } from "@infrastructure/jobs/types/TJobState"
import { DICTIONARY } from "@shared/static/DICTIONARY"

describe("createJobDetails", () => {
  it("возвращает публичное имя, прогресс, попытку и время выполнения", () => {
    const job = {
      id: "job-1",
      name: "internal",
      progress: { progress: 50, status: "working" },
      attemptsStarted: 2,
      timestamp: 1000,
      processedOn: 2000,
      finishedOn: 3000,
      failedReason: "failure",
    } as Job

    expect(
      createJobDetails(job, { state: "failed", name: "sync" }),
    ).toStrictEqual({
      id: "job-1",
      name: "sync",
      state: "failed",
      progress: 50,
      status: "working",
      attempt: 2,
      createdAt: new Date(1000),
      startedAt: new Date(2000),
      finishedAt: new Date(3000),
      failedReason: "failure",
    })
  })

  it.each<TJobState>([
    "queued",
    "running",
    "cancelling",
    "completed",
    "cancelled",
    "failed",
  ])(
    "учитывает состояние %s при выдаче причины ошибки и времени завершения",
    (state) => {
      const job = {
        id: "job-1",
        progress: 0,
        attemptsStarted: 1,
        timestamp: 1000,
        finishedOn: 3000,
        failedReason: "failure",
      } as Job
      const result = createJobDetails(job, { state, name: "sync" })

      expect(result.finishedAt).toEqual(
        ["completed", "cancelled", "failed"].includes(state)
          ? new Date(3000)
          : undefined,
      )
      expect(result.failedReason).toBe(
        state === "failed" ? "failure" : undefined,
      )
      expect(result.startedAt).toBeUndefined()
      expect(result.progress).toBe(0)
      expect(result.status).toBeUndefined()
    },
  )

  it.each([undefined, 0, -1])(
    "исключает отсутствующие или неположительные временные отметки %s",
    (timestamp) => {
      const job = {
        id: "job-1",
        timestamp: 1000,
        processedOn: timestamp,
        finishedOn: timestamp,
        failedReason: "",
        progress: {},
        attemptsStarted: 0,
      } as Job
      const result = createJobDetails(job, { state: "failed", name: "sync" })

      expect(result.startedAt).toBeUndefined()
      expect(result.finishedAt).toBeUndefined()
      expect(result.failedReason).toBeUndefined()
    },
  )

  it.each([undefined, ""])("отклоняет отсутствующий идентификатор %s", (id) => {
    const job = { id } as Job

    expect(() =>
      createJobDetails(job, { state: "queued", name: "sync" }),
    ).toThrow(DICTIONARY.jobs.missingDetailsId)
  })
})
