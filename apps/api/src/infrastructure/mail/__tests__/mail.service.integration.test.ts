import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals"
import { getQueueToken } from "@nestjs/bullmq"
import { Test, type TestingModule } from "@nestjs/testing"
import { Queue } from "bullmq"

import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"
import { JobService } from "@infrastructure/jobs/services/job.service"
import { JOBS_QUEUE_NAME } from "@infrastructure/jobs/static/JOBS_QUEUE_NAME"
import { DICTIONARY } from "@shared/static/DICTIONARY"
import { getTestApplication } from "@test/setup/setupIntegration"

import { MailService } from "../services/mail.service"
import { SEND_MAIL_JOB } from "../static/SEND_MAIL_JOB"

describe("MailService Redis", () => {
  let moduleRef: TestingModule | undefined
  let queue: Queue | undefined
  let service: MailService
  let jobs: JobService

  beforeAll(async () => {
    const { redis } = getTestApplication().app.get(InfrastructureConfigService)
    queue = new Queue(JOBS_QUEUE_NAME, {
      connection: { host: redis.host, port: redis.port, db: redis.database },
      prefix: `mail-test-${randomUUID()}`,
    })
    await queue.waitUntilReady()
    moduleRef = await Test.createTestingModule({
      providers: [
        MailService,
        JobService,
        { provide: getQueueToken(JOBS_QUEUE_NAME), useValue: queue },
      ],
    }).compile()
    await moduleRef.init()
    service = moduleRef.get(MailService)
    jobs = moduleRef.get(JobService)
  })

  afterAll(async () => {
    try {
      await moduleRef?.close()
    } finally {
      await queue?.close()
    }
  })

  it("сохраняет письмо в Redis с конвертом mail.send и настройками повторов", async () => {
    const options = {
      to: ["first@example.test", "second@example.test"],
      subject: "Тема",
      text: "Текст",
      html: "<p>Текст</p>",
      from: "security",
      replyTo: "reply@example.test",
      attachments: [
        { content: Buffer.from([0, 255, 128, 42]), filename: "binary.bin" },
        {
          content: "dGV4dA==",
          filename: "text.txt",
          contentType: "text/plain",
        },
      ],
    } as const
    const result = await service.send({
      ...options,
      to: [...options.to],
      attachments: [...options.attachments],
    })
    const job = await queue?.getJob(result.id)

    expect(result).toStrictEqual({ id: expect.any(String), status: "queued" })
    expect(job?.name).toBe("mail.send")
    expect(job?.data).toStrictEqual({
      name: "mail.send",
      version: 2,
      retryDelays: [1_000, 5_000, 30_000],
      cancellationState: "none",
      payload: {
        ...options,
        attachments: [
          { content: "AP+AKg==", filename: "binary.bin", isBuffer: true },
          {
            content: "dGV4dA==",
            filename: "text.txt",
            contentType: "text/plain",
            isBuffer: false,
          },
        ],
      },
    })
    expect(job?.opts).toMatchObject({
      attempts: 4,
      backoff: { type: "custom" },
    })
    await expect(jobs.get(result.id)).resolves.toMatchObject({
      id: result.id,
      name: SEND_MAIL_JOB.name,
      state: "queued",
    })
  })

  it("сохраняет HTML-письмо без текста и вложений после сериализации Redis", async () => {
    const options = {
      to: "recipient@example.test",
      subject: "HTML",
      html: "<p>Письмо</p>",
    }
    const result = await service.send(options)
    const job = await queue?.getJob(result.id)

    expect(job?.data.payload).toStrictEqual(options)
    expect(await job?.getState()).toBe("waiting")
  })

  it("не создаёт задачу в Redis при ошибке валидации", async () => {
    await expect(
      service.send({ to: "", subject: "Тема", text: "Текст" }),
    ).rejects.toThrow(DICTIONARY.mail.recipientRequired)

    expect(await queue?.getWaitingCount()).toBe(0)
  })
})
