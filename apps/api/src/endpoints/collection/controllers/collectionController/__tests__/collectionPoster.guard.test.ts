import { describe, expect, it, jest } from "@jest/globals"
import {
  BadRequestException,
  UnauthorizedException,
  type ExecutionContext,
} from "@nestjs/common"
import { Types } from "mongoose"

import type { CollectionService } from "@endpoints/collection/services/collectionService"

import { CollectionPosterGuard } from "../guards/collectionPoster.guard"

describe("CollectionPosterGuard", () => {
  const id = new Types.ObjectId()
  const context = (
    params: { id: string },
    isMultipart: boolean,
    cookie?: string,
  ) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          params,
          headers: { cookie },
          isMultipart: () => isMultipart,
        }),
      }),
    }) as ExecutionContext

  const setup = () => {
    const getOwnedCollection =
      jest.fn<CollectionService["getOwnedCollection"]>()
    const guard = new CollectionPosterGuard({
      getOwnedCollection,
    } as unknown as CollectionService)
    return { guard, getOwnedCollection }
  }

  it.each([
    { value: "bad", isMultipart: true },
    { value: id.toHexString(), isMultipart: false },
  ])(
    "отклоняет неподходящий запрос до проверки владельца: %j",
    async ({ value, isMultipart }) => {
      const { guard, getOwnedCollection } = setup()

      await expect(
        guard.canActivate(context({ id: value }, isMultipart)),
      ).rejects.toThrow(BadRequestException)
      expect(getOwnedCollection).not.toHaveBeenCalled()
    },
  )

  it("передаёт проверке владельца access cookie и ObjectId подборки", async () => {
    const { guard, getOwnedCollection } = setup()
    const request = context(
      { id: id.toHexString() },
      true,
      "other=1; __Host-accessToken=access; __Host-refreshToken=refresh",
    )

    await expect(guard.canActivate(request)).resolves.toBe(true)
    expect(getOwnedCollection).toHaveBeenCalledWith("access", id)
  })

  it("отклоняет запрос, когда проверка владельца вернула ошибку авторизации", async () => {
    const { guard, getOwnedCollection } = setup()
    getOwnedCollection.mockRejectedValueOnce(new UnauthorizedException())

    await expect(
      guard.canActivate(context({ id: id.toHexString() }, true)),
    ).rejects.toThrow(UnauthorizedException)
    expect(getOwnedCollection).toHaveBeenCalledWith(undefined, id)
  })
})
