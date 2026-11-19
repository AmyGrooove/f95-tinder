import {
  beforeEach,
  describe,
  expect,
  it,
  jest,
  afterAll,
  beforeAll,
} from "@jest/globals"
import { Test, type TestingModule } from "@nestjs/testing"
import { JobService } from "@infrastructure/jobs/services/jobService"
import { DICTIONARY } from "@shared/static/DICTIONARY"
import { MailService } from "../core/mail.service"
import { SEND_MAIL_JOB } from "../../../static/SEND_MAIL_JOB"
import type { ISendMailOptions } from "../types/ISendMailOptions"
import { randomUUID } from "node:crypto"
import { getQueueToken } from "@nestjs/bullmq"
import { Queue } from "bullmq"
import { JOBS_QUEUE_NAME } from "@infrastructure/jobs/static/JOBS_QUEUE_NAME"

if (Reflect.get(globalThis, "IS_INTEGRATION_TEST") === true) {
  const { getTestRedis } =
    await import("@infrastructure/cache/__tests__/setup/setupRedis")

  describe("MailService", () => {
    let moduleRef: TestingModule | undefined
    let queue: Queue | undefined
    let service: MailService
    let jobs: JobService

    beforeAll(async () => {
      const { redis } = getTestRedis().configuration
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
      const waitingCount = await queue?.getWaitingCount()

      await expect(
        service.send({ to: "", subject: "Тема", text: "Текст" }),
      ).rejects.toThrow(DICTIONARY.mail.recipientRequired)

      expect(await queue?.getWaitingCount()).toBe(waitingCount)
    })
  })
} else {
  describe("MailService", () => {
    const add = jest.fn<JobService["add"]>()
    let service: MailService
    const options: ISendMailOptions = {
      to: "recipient@example.test",
      subject: "Тема письма",
      text: "Текст письма",
    }
    beforeEach(async () => {
      add.mockReset().mockResolvedValue("queue-id")
      const moduleRef = await Test.createTestingModule({
        providers: [MailService, { provide: JobService, useValue: { add } }],
      }).compile()
      service = moduleRef.get(MailService)
    })

    it("возвращает идентификатор очереди и статус queued", async () => {
      await expect(service.send(options)).resolves.toStrictEqual({
        id: "queue-id",
        status: "queued",
      })
      expect(add).toHaveBeenCalledTimes(1)
      expect(add).toHaveBeenCalledWith(SEND_MAIL_JOB, {
        ...options,
        attachments: undefined,
      })
    })

    it.each(["", "   ", []])(
      "отклоняет пустого получателя %p без постановки задачи",
      async (to) => {
        await expect(service.send({ ...options, to })).rejects.toThrow(
          DICTIONARY.mail.recipientRequired,
        )
        expect(add).not.toHaveBeenCalled()
      },
    )

    it.each(["", " \t\n "])(
      "отклоняет пустую тему %p без постановки задачи",
      async (subject) => {
        await expect(service.send({ ...options, subject })).rejects.toThrow(
          DICTIONARY.mail.subjectRequired,
        )
        expect(add).not.toHaveBeenCalled()
      },
    )

    it.each([
      { text: undefined, html: undefined },
      { text: "", html: undefined },
      { text: undefined, html: "" },
      { text: "", html: "" },
    ])("отклоняет письмо без содержимого %p", async (content) => {
      await expect(service.send({ ...options, ...content })).rejects.toThrow(
        DICTIONARY.mail.contentRequired,
      )
      expect(add).not.toHaveBeenCalled()
    })

    it.each([
      { text: "Текст", html: undefined },
      { text: undefined, html: "<p>Письмо</p>" },
      { text: "", html: "<p>Письмо</p>" },
      { text: "Текст", html: "" },
      { text: "Текст", html: "<p>Письмо</p>" },
    ])("ставит в очередь письмо с содержимым %p", async (content) => {
      await service.send({ ...options, ...content })

      expect(add).toHaveBeenCalledWith(SEND_MAIL_JOB, {
        ...options,
        ...content,
        attachments: undefined,
      })
    })

    it("сохраняет адресатов, отправителя и адреса для ответа", async () => {
      const message: ISendMailOptions = {
        ...options,
        to: ["first@example.test", "second@example.test"],
        from: "support",
        replyTo: ["reply@example.test"],
      }

      await service.send(message)

      expect(add).toHaveBeenCalledWith(SEND_MAIL_JOB, {
        ...message,
        attachments: undefined,
      })
    })

    it("кодирует Buffer в base64, сохраняет строковые вложения и не меняет исходные данные", async () => {
      const content = Buffer.from([0, 255, 128, 42])
      const attachments = [
        {
          content,
          filename: "binary.bin",
          contentType: "application/octet-stream",
        },
        { content: "c3RyaW5n", filename: "text.txt" },
      ]

      await service.send({ ...options, attachments })

      expect(add).toHaveBeenCalledWith(SEND_MAIL_JOB, {
        ...options,
        attachments: [
          {
            content: "AP+AKg==",
            filename: "binary.bin",
            contentType: "application/octet-stream",
            isBuffer: true,
          },
          { content: "c3RyaW5n", filename: "text.txt", isBuffer: false },
        ],
      })
      expect(attachments).toStrictEqual([
        {
          content: Buffer.from([0, 255, 128, 42]),
          filename: "binary.bin",
          contentType: "application/octet-stream",
        },
        { content: "c3RyaW5n", filename: "text.txt" },
      ])
    })

    it("сохраняет пустой список вложений", async () => {
      await service.send({ ...options, attachments: [] })

      expect(add).toHaveBeenCalledWith(SEND_MAIL_JOB, {
        ...options,
        attachments: [],
      })
    })

    it("передаёт вызывающему коду ошибку очереди", async () => {
      const error = new Error("Очередь недоступна")
      add.mockRejectedValueOnce(error)

      await expect(service.send(options)).rejects.toBe(error)
      expect(add).toHaveBeenCalledTimes(1)
    })
  })
}
