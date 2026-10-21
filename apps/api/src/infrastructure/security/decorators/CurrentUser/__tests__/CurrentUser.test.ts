import { describe, expect, it } from "@jest/globals"
import type { ExecutionContext } from "@nestjs/common"
import { ROUTE_ARGS_METADATA } from "@nestjs/common/constants"
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host"

import type { IAuthPrincipal } from "@infrastructure/security/types/IAuthPrincipal"
import type { ICurrentUserRequest } from "@infrastructure/security/types/ICurrentUserRequest"

import { CurrentUser } from "../index"

describe("CurrentUser", () => {
  const resolveCurrentUser = (
    request: ICurrentUserRequest,
    field?: keyof IAuthPrincipal,
  ) => {
    class TestController {
      handle(user: unknown) {
        return user
      }
    }

    const decorator = field === undefined ? CurrentUser() : CurrentUser(field)

    decorator(TestController.prototype, "handle", 0)

    const metadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      TestController,
      "handle",
    ) as Record<
      string,
      {
        data: keyof IAuthPrincipal | undefined
        factory: (
          data: keyof IAuthPrincipal | undefined,
          context: ExecutionContext,
        ) => unknown
      }
    >
    const parameters = Object.values(metadata)

    expect(parameters).toHaveLength(1)

    const [parameter] = parameters

    return parameter.factory(
      parameter.data,
      new ExecutionContextHost([request]),
    )
  }

  const principal: IAuthPrincipal = {
    id: "user-id",
    sessionId: "session-id",
    role: "admin",
  }

  it("возвращает principal запроса без выбора поля", () => {
    expect(resolveCurrentUser({ authPrincipal: principal })).toBe(principal)
  })

  it.each(["id", "sessionId", "role"] as const)(
    "возвращает поле %s из principal запроса",
    (field) => {
      expect(resolveCurrentUser({ authPrincipal: principal }, field)).toBe(
        principal[field],
      )
    },
  )

  it.each([undefined, "id", "sessionId", "role"] as const)(
    "возвращает undefined без principal при выборе поля %s",
    (field) => {
      expect(resolveCurrentUser({}, field)).toBeUndefined()
    },
  )
})
