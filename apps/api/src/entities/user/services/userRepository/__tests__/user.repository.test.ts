import { createHash } from "node:crypto"

import { describe, expect, it, jest } from "@jest/globals"
import { Types } from "mongoose"
import type { ClientSession } from "mongoose"

import { UserRepository } from "../core/user.repository"

describe("UserRepository", () => {
  const createRepository = () =>
    new UserRepository({} as ConstructorParameters<typeof UserRepository>[0])
  const hash = (code: string) => createHash("sha256").update(code).digest("hex")

  it("ищет беспарольного пользователя по хешу кода доступа", async () => {
    const repository = createRepository()
    const findOne = jest
      .spyOn(repository.read, "findOne")
      .mockResolvedValue(null)

    await expect(repository.findByAccessCode("current")).resolves.toBeNull()
    expect(findOne).toHaveBeenCalledWith(
      { accessCodeHash: hash("current"), passwordHash: null },
      { _id: 1, role: 1 },
    )
  })

  it("возвращает новый код доступа и сохраняет его хеш вместе с именем", async () => {
    const repository = createRepository()
    const record = { _id: new Types.ObjectId() } as Awaited<
      ReturnType<typeof repository.write.create>
    >
    const create = jest
      .spyOn(repository.write, "create")
      .mockResolvedValue(record)
    const session = {} as ClientSession
    const { user, accessCode } = await repository.createNew({ session })
    const [[payload]] = create.mock.calls

    expect(user).toBe(record)
    expect(Buffer.from(accessCode, "base64url")).toHaveLength(24)
    expect(payload.displayName).toMatch(/\d{3}$/)
    expect(create).toHaveBeenCalledWith(
      {
        displayName: payload.displayName,
        username: payload.displayName?.toLowerCase(),
        accessCodeHash: hash(accessCode),
      },
      { session },
    )
  })

  it("заменяет код только при совпадении текущего кода и отсутствии пароля", async () => {
    const repository = createRepository()
    const update = jest
      .spyOn(repository.write, "updateByFilter")
      .mockResolvedValue(null)
    const userId = new Types.ObjectId()
    const session = {} as ClientSession
    const { user, accessCode } = await repository.reissueAccessCode(
      { userId, accessCode: "current" },
      { session },
    )

    expect(user).toBeNull()
    expect(Buffer.from(accessCode, "base64url")).toHaveLength(24)
    expect(update).toHaveBeenCalledWith(
      { _id: userId, accessCodeHash: hash("current"), passwordHash: null },
      { $set: { accessCodeHash: hash(accessCode) } },
      { session, projection: { _id: 1, role: 1 } },
    )
  })

  it("заменяет пароль при совпадении id, email и прежнего хеша", async () => {
    const repository = createRepository()
    const update = jest
      .spyOn(repository.write, "updateByFilter")
      .mockResolvedValue(null)
    const userId = new Types.ObjectId()
    const email = "user@example.test"

    await expect(
      repository.replacePassword({
        userId,
        email,
        currentPasswordHash: "old",
        passwordHash: "new",
      }),
    ).resolves.toBeNull()
    expect(update).toHaveBeenCalledWith(
      { _id: userId, email, passwordHash: "old" },
      { $set: { passwordHash: "new" } },
      { projection: { _id: 1 } },
    )
  })
})
