import { describe, expect, it } from "@jest/globals"
import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from "@nestjs/common"
import { Reflector } from "@nestjs/core"

import { Roles } from "@infrastructure/security/decorators/Roles"
import { RolesGuard } from "../core/roles.guard"

@Roles("admin")
class RestrictedController {
  @Roles("editor")
  edit() {}

  read() {}
}

const createContext = (handler: () => void, role?: string) => {
  const authPrincipal =
    role === undefined ? undefined : { id: "user", sessionId: "session", role }

  return {
    getHandler: () => handler,
    getClass: () => RestrictedController,
    switchToHttp: () => ({ getRequest: () => ({ authPrincipal }) }),
  } as unknown as ExecutionContext
}

describe("RolesGuard", () => {
  it("допускает запрос без пользователя, когда роли не заданы", () => {
    const context = {
      getHandler: () => () => undefined,
      getClass: () => class PublicController {},
    } as unknown as ExecutionContext

    expect(new RolesGuard(new Reflector()).canActivate(context)).toBe(true)
  })

  it("применяет роль класса, если метод не задаёт собственную роль", () => {
    const context = createContext(RestrictedController.prototype.read, "admin")

    expect(new RolesGuard(new Reflector()).canActivate(context)).toBe(true)
  })

  it("применяет роль метода поверх роли класса", () => {
    const guard = new RolesGuard(new Reflector())
    const handler = RestrictedController.prototype.edit

    expect(guard.canActivate(createContext(handler, "editor"))).toBe(true)
    expect(() => guard.canActivate(createContext(handler, "admin"))).toThrow(
      ForbiddenException,
    )
  })

  it("отклоняет запрос без пользователя на защищённом методе", () => {
    const context = createContext(RestrictedController.prototype.read)

    expect(() => new RolesGuard(new Reflector()).canActivate(context)).toThrow(
      UnauthorizedException,
    )
  })
})
