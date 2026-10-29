import { expect } from "@jest/globals"

import type { User } from "@entities/user/schemas/user.schema"
import type { Session } from "@entities/session/schemas/session.schema"
import type { RegisterResponseDto } from "@endpoints/auth/dto/response/register.response"
import { hashValue } from "@infrastructure/security/functions/hashValue"
import { getTestApplication } from "@test/setup/setupIntegration"

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

  const registration = response.json<RegisterResponseDto>()
  const users = connection.collection<User>("User")
  const password = "Initial-password-123"

  if (kind === "password") {
    await users.updateOne(
      { username: registration.username },
      {
        $set: {
          email: `${registration.username}@example.test`,
          passwordHash: await hashValue(password),
          accessCodeHash: null,
        },
      },
    )
  }

  const user = await users.findOne({ username: registration.username })

  if (user === null) {
    throw new Error("Зарегистрированный пользователь не найден")
  }

  const session = await connection
    .collection<Session>("Session")
    .findOne({ user: user._id })

  if (session === null) {
    throw new Error("Сессия зарегистрированного пользователя не найдена")
  }

  return {
    user,
    session,
    password,
    accessCode: registration.accessCode,
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
