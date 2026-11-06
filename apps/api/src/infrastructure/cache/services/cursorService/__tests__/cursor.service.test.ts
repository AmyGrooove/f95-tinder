import { describe, expect, it } from "@jest/globals"
import { BadRequestException } from "@nestjs/common"

import { CursorService } from "../index"

import { CURSOR_FIXTURES } from "./static/CURSOR_FIXTURES"

describe("CursorService", () => {
  const service = new CursorService()
  const { search, tags, unsupportedVersion, invalidPosition, errorMessage } =
    CURSOR_FIXTURES
  const tagReadProps = {
    scope: tags.scope,
    invalidCursorMessage: errorMessage,
    isPosition: (value: unknown): value is number => typeof value === "number",
  }

  it("читает и создаёт курсор Search с позициями групп в прежнем формате", () => {
    expect(service.create(search)).toBe(search.cursor)
    expect(
      service.read({
        cursor: search.cursor,
        scope: search.scope,
        invalidCursorMessage: errorMessage,
        isPosition: (value): value is (number | null)[] =>
          Array.isArray(value) &&
          value.every(
            (offset) => typeof offset === "number" || offset === null,
          ),
      }),
    ).toEqual(search.position)
  })

  it("читает и создаёт курсор Tags с одним смещением в прежнем формате", () => {
    expect(service.create(tags)).toBe(tags.cursor)
    expect(service.read({ ...tagReadProps, cursor: tags.cursor })).toBe(50)
  })

  it.each([
    ["неканонической кодировкой", `${tags.cursor}=`],
    ["невалидным JSON", "ew"],
    ["неверной структурой", "W10"],
    ["неподдерживаемой версией", unsupportedVersion],
    ["позицией, отклонённой потребителем", invalidPosition],
  ])("отклоняет курсор с %s", (_reason, cursor) => {
    expect(() => service.read({ ...tagReadProps, cursor })).toThrow(
      expect.objectContaining({
        constructor: BadRequestException,
        message: errorMessage,
      }),
    )
  })

  it.each([
    ["поисковый текст", ["other", [], [], [], 50]],
    ["фильтр", ["space", ["group"], [], [], 50]],
    ["лимит", ["space", [], [], [], 20]],
  ])("отклоняет курсор, если изменился %s", (_parameter, scope) => {
    expect(() =>
      service.read({ ...tagReadProps, scope, cursor: tags.cursor }),
    ).toThrow(expect.objectContaining({ message: errorMessage }))
  })
})
