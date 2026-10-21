import { describe, expect, it } from "@jest/globals"
import { Reflector } from "@nestjs/core"

import { Roles, ROLES_METADATA_KEY } from "../index"

describe("Roles", () => {
  it("сохраняет разрешённые роли в метаданных контроллера", () => {
    @Roles("admin", "moderator")
    class TestController {}

    expect(new Reflector().get(ROLES_METADATA_KEY, TestController)).toEqual([
      "admin",
      "moderator",
    ])
  })

  it("сохраняет роли метода независимо от ролей контроллера", () => {
    @Roles("admin")
    class TestController {
      @Roles("moderator", "user")
      handle() {
        return "value"
      }
    }

    const reflector = new Reflector()

    expect(
      reflector.getAllAndOverride(ROLES_METADATA_KEY, [
        TestController.prototype.handle,
        TestController,
      ]),
    ).toEqual(["moderator", "user"])
    expect(reflector.get(ROLES_METADATA_KEY, TestController)).toEqual(["admin"])
    expect(TestController.prototype.handle()).toBe("value")
  })

  it("сохраняет пустой список ролей при вызове без аргументов", () => {
    @Roles()
    class TestController {}

    expect(new Reflector().get(ROLES_METADATA_KEY, TestController)).toEqual([])
  })

  it("позволяет пустому списку ролей метода переопределить роли контроллера", () => {
    @Roles("admin")
    class TestController {
      @Roles()
      handle() {
        return "value"
      }
    }

    expect(
      new Reflector().getAllAndOverride(ROLES_METADATA_KEY, [
        TestController.prototype.handle,
        TestController,
      ]),
    ).toEqual([])
  })
})
