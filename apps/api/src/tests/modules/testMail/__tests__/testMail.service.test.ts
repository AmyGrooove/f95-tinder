import { describe, expect, it } from "@jest/globals"

import { TestMailService } from "../testMail.service"

describe("TestMailService", () => {
  it("сохраняет письмо и возвращает уникальный идентификатор очереди", async () => {
    const service = new TestMailService()
    const options = {
      to: "user@example.test",
      subject: "Тема",
      text: "Текст",
    }

    const first = await service.send(options)
    const second = await service.send(options)

    expect(first).toStrictEqual({ id: expect.any(String), status: "queued" })
    expect(first.id).not.toBe(second.id)
    expect(service.messages).toStrictEqual([options, options])
  })

  it("сохраняет независимую копию адресатов и вложений с исходным типом Buffer", async () => {
    const service = new TestMailService()
    const buffer = Buffer.from([0, 255, 128])
    const options = {
      to: ["user@example.test"],
      replyTo: ["reply@example.test"],
      subject: "Тема",
      html: "<p>Текст</p>",
      attachments: [
        { filename: "binary.bin", content: buffer },
        { filename: "text.txt", content: "dGV4dA==" },
      ],
    }

    await service.send(options)

    expect(service.messages[0]).toStrictEqual(options)

    options.to.push("other@example.test")
    options.replyTo.length = 0
    options.attachments[0].filename = "changed.bin"
    buffer.fill(1)
    options.attachments.length = 0

    expect(service.messages[0]).toStrictEqual({
      to: ["user@example.test"],
      replyTo: ["reply@example.test"],
      subject: "Тема",
      html: "<p>Текст</p>",
      attachments: [
        { filename: "binary.bin", content: Buffer.from([0, 255, 128]) },
        { filename: "text.txt", content: "dGV4dA==" },
      ],
    })
  })

  it("очищает письма повторно и позволяет записать новое письмо", async () => {
    const service = new TestMailService()
    const options = { to: "user@example.test", subject: "Тема", text: "Текст" }

    await service.send(options)
    service.clear()
    service.clear()

    expect(service.messages).toStrictEqual([])

    await service.send(options)

    expect(service.messages).toStrictEqual([options])
  })
})
