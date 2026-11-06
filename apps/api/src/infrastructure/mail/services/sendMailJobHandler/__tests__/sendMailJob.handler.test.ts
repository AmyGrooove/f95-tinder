import { describe, expect, it, jest } from "@jest/globals"
import type { Resend } from "resend"

import type { InfrastructureConfigService } from "@infrastructure/config/services/configService"
import { DICTIONARY } from "@shared/static/DICTIONARY"
import { SendMailJobHandler } from "../core/sendMailJob.handler"

const createHandler = () => {
  const send = jest.fn<Resend["emails"]["send"]>()
  const context = {
    id: "job-id",
    attempt: 1,
    updateProgress: jest.fn<() => Promise<void>>(),
    throwIfCancelled: jest
      .fn<() => Promise<void>>()
      .mockResolvedValue(undefined),
  }
  const configuration = {
    mail: { domain: "example.test" },
  } as InfrastructureConfigService
  const handler = new SendMailJobHandler(
    { emails: { send } } as unknown as Resend,
    configuration,
  )
  const payload = { to: "user@example.test", subject: "Письмо" }

  return { send, handler, context, payload }
}

describe("SendMailJobHandler", () => {
  it("отправляет HTML и текст с вложением и ключом идемпотентности задачи", async () => {
    const { send, handler, context, payload } = createHandler()
    send.mockResolvedValue({
      data: { id: "delivery-id" },
      error: null,
      headers: null,
    })

    await expect(
      handler.handle(
        {
          ...payload,
          from: "support",
          replyTo: "reply@example.test",
          html: "<p>Письмо</p>",
          text: "Письмо",
          attachments: [
            {
              filename: "file.txt",
              content: "YQ==",
              contentType: "text/plain",
              isBuffer: true,
            },
          ],
        },
        context,
      ),
    ).resolves.toEqual({ id: "delivery-id", status: "sent" })

    expect(send).toHaveBeenCalledWith(
      {
        ...payload,
        from: `${DICTIONARY.mail.senders.support} <support@example.test>`,
        replyTo: "reply@example.test",
        html: "<p>Письмо</p>",
        text: "Письмо",
        attachments: [
          { filename: "file.txt", content: "YQ==", contentType: "text/plain" },
        ],
      },
      { idempotencyKey: "mail.send:job-id" },
    )
  })

  it("отправляет текст при пустом HTML с адреса по умолчанию", async () => {
    const { send, handler, context, payload } = createHandler()
    send.mockResolvedValue({
      data: { id: "delivery-id" },
      error: null,
      headers: null,
    })

    await handler.handle({ ...payload, html: "", text: "Письмо" }, context)

    expect(send.mock.calls[0][0]).toMatchObject({
      text: "Письмо",
      from: `${DICTIONARY.mail.senders["no-reply"]} <no-reply@example.test>`,
    })
    expect(send.mock.calls[0][0]).not.toHaveProperty("html")
  })

  it("отклоняет письмо без содержимого до обращения к провайдеру", async () => {
    const { send, handler, context, payload } = createHandler()

    await expect(handler.handle(payload, context)).rejects.toThrow(
      DICTIONARY.mail.contentRequired,
    )
    expect(send).not.toHaveBeenCalled()
  })

  it("отменяет отправку, если задача отменена", async () => {
    const { send, handler, context, payload } = createHandler()
    const error = new Error("cancelled")
    context.throwIfCancelled.mockRejectedValue(error)

    await expect(
      handler.handle({ ...payload, text: "Письмо" }, context),
    ).rejects.toBe(error)
    expect(send).not.toHaveBeenCalled()
  })

  it("возвращает ошибку при успешном ответе без идентификатора доставки", async () => {
    const { send, handler, context, payload } = createHandler()
    send.mockResolvedValue({ data: { id: "" }, error: null, headers: null })

    await expect(
      handler.handle({ ...payload, text: "Письмо" }, context),
    ).rejects.toThrow(DICTIONARY.mail.deliveryIdMissing)
  })

  it("сохраняет ошибку провайдера как причину отказа в доставке", async () => {
    const { send, handler, context, payload } = createHandler()
    const error = {
      name: "validation_error",
      message: "invalid",
      statusCode: 422,
    } as const
    send.mockResolvedValue({ data: null, error, headers: null })

    await expect(
      handler.handle({ ...payload, text: "Письмо" }, context),
    ).rejects.toMatchObject({
      message: DICTIONARY.mail.providerRejected,
      cause: error,
    })
  })
})
