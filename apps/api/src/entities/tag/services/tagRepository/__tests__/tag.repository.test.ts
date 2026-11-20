import { describe, expect, it, jest } from "@jest/globals"

import { TagRepository } from "../core/tag.repository"

describe("TagRepository", () => {
  it("ждёт инициализации модели до завершения запуска модуля", async () => {
    let finish!: () => void
    const init = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    const repository = new TagRepository({
      init,
    } as unknown as ConstructorParameters<typeof TagRepository>[0])
    const onReady = jest.fn()
    const ready = repository.onModuleInit().then(onReady)

    expect(init).toHaveBeenCalledTimes(1)
    await Promise.resolve()
    expect(onReady).not.toHaveBeenCalled()

    finish()
    await ready
    expect(onReady).toHaveBeenCalledTimes(1)
  })

  it("передаёт ошибку инициализации модели", async () => {
    const error = new Error("Ошибка создания индекса")
    const init = jest.fn(async () => {
      throw error
    })
    const repository = new TagRepository({
      init,
    } as unknown as ConstructorParameters<typeof TagRepository>[0])

    await expect(repository.onModuleInit()).rejects.toBe(error)
  })
})
