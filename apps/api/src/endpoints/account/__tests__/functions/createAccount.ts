import { createHash, randomBytes } from "node:crypto"
import { Types } from "mongoose"
import { expect } from "@jest/globals"

import type { User } from "@entities/user/schemas/user.schema"
import type { UserSession } from "@entities/userSession/schemas/userSession.schema"
import { SecurityJwtService } from "@infrastructure/security/services/jwtService"
import { hashValue } from "@infrastructure/security/functions/hashValue"
import { getTestApplication } from "@app/__tests__/setup/setupIntegration"

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
  expect(response.statusCode).toBe(204)
  expect(response.body).toBe("")

  const accessToken =
    response.cookies.find(({ name }) => name === "__Host-accessToken")?.value ??
    ""
  const { sub, sessionId } = await app
    .get(SecurityJwtService)
    .verifyAccessToken(accessToken)
  const userId = new Types.ObjectId(sub)
  const accessCode = randomBytes(24).toString("base64url")
  const users = connection.collection<User>("User")
  const password = "Initial-password-123"

  const user = await users.findOneAndUpdate(
    { _id: userId },
    {
      $set:
        kind === "password"
          ? {
              email: sub + "@example.test",
              passwordHash: await hashValue(password),
              accessCodeHash: null,
            }
          : {
              accessCodeHash: createHash("sha256")
                .update(accessCode)
                .digest("hex"),
            },
    },
    { returnDocument: "after" },
  )

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
