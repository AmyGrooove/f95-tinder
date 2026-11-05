import { describe, expect, it } from "@jest/globals"

import { normalizeMultipartFields } from "../core/normalizeMultipartFields"

describe("normalizeMultipartFields", () => {
  it("разворачивает одиночные поля и элементы массивов, сохраняя остальные значения", () => {
    const fields = {
      title: { value: "name", fieldname: "title" },
      tags: [{ value: "first" }, "second", null, { other: 1 }],
      count: 0,
      empty: null,
      missing: undefined,
      metadata: { other: 1 },
      nested: { value: { value: "inner" } },
    }

    expect(normalizeMultipartFields(fields)).toStrictEqual({
      title: "name",
      tags: ["first", "second", null, { other: 1 }],
      count: 0,
      empty: null,
      missing: undefined,
      metadata: { other: 1 },
      nested: { value: "inner" },
    })
    expect(fields.title).toStrictEqual({ value: "name", fieldname: "title" })
    expect(fields.tags[0]).toStrictEqual({ value: "first" })
  })

  it("сохраняет пустые и ложные значения внутри полей", () => {
    expect(
      normalizeMultipartFields({
        fields: [
          { value: false },
          { value: 0 },
          { value: "" },
          { value: null },
          { value: undefined },
        ],
      }),
    ).toStrictEqual({ fields: [false, 0, "", null, undefined] })
  })

  it("возвращает пустой объект для отсутствующих полей", () => {
    expect(normalizeMultipartFields({})).toStrictEqual({})
  })
})
