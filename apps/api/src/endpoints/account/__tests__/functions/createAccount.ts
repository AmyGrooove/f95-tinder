import { Types } from "mongoose"
import { expect } from "@jest/globals"

import type { User } from "@entities/user/schemas/user.schema"
import type { UserSession } from "@entities/userSession/schemas/userSession.schema"
import { SecurityJwtService } from "@infrastructure/security/services/jwtService"
import { hashValue } from "@infrastructure/security/functions/hashValue"
import { getTestApplication } from "@app/__tests__/setup/setupIntegration"
import type { RegisterResponseDto } from "@endpoints/auth/services/authService"

const createAccount = async (
  kind: "anonymous" | "password" = "anonymous",
  ip?: string,
) => {
  const { app, connection } = getTestApplication()
  const response = await app.inject({
    method: "POST",
    url: "/auth/register",
    headers: {
      origin: "http://localhost",
      ...(ip === undefined ? {} : { "x-forwarded-for": ip }),
    },
  })
  expect(response.statusCode).toBe(201)
  const { accessCode } = response.json<RegisterResponseDto>()

  const accessToken =
    response.cookies.find(({ name }) => name === "__Host-accessToken")?.value ??
    ""
  const { sub, sessionId } = await app
    .get(SecurityJwtService)
    .verifyAccessToken(accessToken)
  const userId = new Types.ObjectId(sub)
  const users = connection.collection<User>("User")
  const password = "Initial-password-123"

  const user =
    kind === "password"
      ? await users.findOneAndUpdate(
          { _id: userId },
          {
            $set: {
              email: sub + "@example.test",
              passwordHash: await hashValue(password),
              accessCodeHash: null,
            },
          },
          { returnDocument: "after" },
        )
      : await users.findOne({ _id: userId })

  if (user === null) {
    throw new Error("Зарегистрированный пользователь не найден")
  }

  const session = await connection
    .collection<UserSession>("UserSession")
    .findOne({ _id: new Types.ObjectId(sessionId), user: user._id })

  if (session === null) {
    throw new Error("Сессия зарегистрированного пользователя не найдена")
  }

  return {
    user,
    session,
    password,
    accessCode,
    headers: {
      origin: "http://localhost",
      ...(ip === undefined ? {} : { "x-forwarded-for": ip }),
      cookie: response.cookies
        .map(({ name, value }) => `${name}=${value}`)
        .join("; "),
    },
  }
}

export { createAccount }
