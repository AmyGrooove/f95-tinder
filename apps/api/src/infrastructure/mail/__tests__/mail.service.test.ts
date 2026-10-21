import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { Test } from "@nestjs/testing"

import { JobService } from "@infrastructure/jobs/services/job.service"
import { DICTIONARY } from "@shared/static/DICTIONARY"

import { MailService } from "../services/mail.service"
import { SEND_MAIL_JOB } from "../static/SEND_MAIL_JOB"
import type { ISendMailOptions } from "../types/ISendMailOptions"

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
