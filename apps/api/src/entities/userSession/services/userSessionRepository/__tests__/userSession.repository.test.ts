import { createHash } from "node:crypto"

import { describe, expect, it, jest } from "@jest/globals"
import { Types } from "mongoose"
import type { ClientSession } from "mongoose"

import { JWT_REFRESH_EXPIRATION } from "@infrastructure/security/static/JWT_REFRESH_EXPIRATION"

import { UserSessionRepository } from ".."
import type { Model, HydratedDocument } from "mongoose"
import type { UserSession } from "../../../schemas/userSession.schema"

describe("UserSessionRepository", () => {
  it("ограничивает поиск и удаление активной сессии владельцем и строгим сроком действия", async () => {
    const repository = new UserSessionRepository(
      {} as Model<HydratedDocument<UserSession>>,
    )
    const find = jest.spyOn(repository.read, "findOne").mockResolvedValue(null)
    const remove = jest
      .spyOn(repository.write, "deleteByFilter")
      .mockResolvedValue(null)
    const id = new Types.ObjectId()
    const userId = new Types.ObjectId()
    jest.useFakeTimers()

    try {
      const filter = { _id: id, user: userId, expiresAt: { $gt: new Date() } }

      await expect(repository.findActive({ id, userId })).resolves.toBeNull()
      await expect(repository.deleteActive({ id, userId })).resolves.toBeNull()

      expect(find).toHaveBeenCalledWith(filter, {
        _id: 1,
        expiresAt: 1,
        country: 1,
      })
      expect(remove).toHaveBeenCalledWith(filter)
    } finally {
      jest.useRealTimers()
    }
  })

  it.each([undefined, "previous-token"])(
    "обновляет хеш и срок действия сессии при текущем токене %j",
    async (currentRefreshToken) => {
      const repository = new UserSessionRepository(
        {} as Model<HydratedDocument<UserSession>>,
      )
      const update = jest
        .spyOn(repository.write, "updateByFilter")
        .mockResolvedValue(null)
      const id = new Types.ObjectId()
      const userId = new Types.ObjectId()
      const refreshToken = "next-token"
      const session = {} as ClientSession
      jest.useFakeTimers()

      try {
        const now = new Date()
        const hash = (token: string) =>
          createHash("sha256").update(token).digest("hex")

        await expect(
          repository.updateRefreshToken(
            { id, userId, currentRefreshToken, refreshToken },
            { session },
          ),
        ).resolves.toBeNull()

        expect(update).toHaveBeenCalledWith(
          {
            _id: id,
            user: userId,
            expiresAt: { $gt: now },
            ...(currentRefreshToken === undefined
              ? {}
              : { refreshTokenHash: hash(currentRefreshToken) }),
          },
          {
            $set: {
              refreshTokenHash: hash(refreshToken),
              lastRefreshedAt: now,
              expiresAt: new Date(
                now.getTime() + JWT_REFRESH_EXPIRATION * 1000,
              ),
            },
          },
          { session },
        )
      } finally {
        jest.useRealTimers()
      }
    },
  )
})
