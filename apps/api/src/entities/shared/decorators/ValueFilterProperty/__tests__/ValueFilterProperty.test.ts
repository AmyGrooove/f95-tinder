import { describe, expect, it } from "@jest/globals"
import { plainToInstance } from "class-transformer"
import { validateSync } from "class-validator"

import { ValueFilterProperty } from "../core/ValueFilterProperty"

describe("ValueFilterProperty", () => {
  class FilterDto {
    @ValueFilterProperty({ values: ["planned", "completed", null] })
    statuses?: unknown

    @ValueFilterProperty({ maxGroups: 2 })
    tags?: unknown
  }

  const validate = (payload: object) =>
    validateSync(plainToInstance(FilterDto, payload), {
      whitelist: true,
      forbidNonWhitelisted: true,
    })

  it("принимает отсутствующие фильтры, null в списке значений и группы ObjectId", () => {
    expect(validate({})).toEqual([])
    expect(
      validate({
        statuses: { allOf: ["planned"], anyOf: [null, "completed"] },
        tags: [{ anyOf: ["507f1f77bcf86cd799439011"] }, {}],
      }),
    ).toEqual([])
  })

  it.each([
    ["пустой список", { anyOf: [] }],
    ["неизвестное значение", { allOf: ["dropped"] }],
    ["повтор", { noneOf: ["planned", "planned"] }],
    ["неизвестное поле", { someOf: ["planned"] }],
    ["null вместо фильтра", null],
  ])("отклоняет %s в фильтре статусов", (_label, statuses) => {
    expect(validate({ statuses })).toEqual([
      expect.objectContaining({ property: "statuses" }),
    ])
  })

  it.each([
    ["объект вместо списка групп", { anyOf: ["507f1f77bcf86cd799439011"] }],
    ["слишком много групп", [{}, {}, {}]],
    ["некорректный id", [{ allOf: ["bad-id"] }]],
    [
      "одинаковые id в разном регистре",
      [{ anyOf: ["507f1f77bcf86cd799439011", "507F1F77BCF86CD799439011"] }],
    ],
  ])("отклоняет %s в фильтре тегов", (_label, tags) => {
    expect(validate({ tags })).toEqual([
      expect.objectContaining({ property: "tags" }),
    ])
  })
})
