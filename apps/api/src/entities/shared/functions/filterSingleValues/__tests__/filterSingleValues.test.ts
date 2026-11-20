import { describe, expect, it } from "@jest/globals"

import { filterSingleValues } from "../core/filterSingleValues"

describe("filterSingleValues", () => {
  it("сохраняет порядок, повторы и null при отсутствии ограничений", () => {
    expect(filterSingleValues(["a", null, "a", "b"])).toEqual([
      "a",
      null,
      "a",
      "b",
    ])
  })

  it("пересекает условия допуска и исключает запрещённые значения", () => {
    expect(
      filterSingleValues(["a", null, "b"], {
        anyOf: ["b", null],
        allOf: [null],
        noneOf: ["b"],
      }),
    ).toEqual([null])
    expect(
      filterSingleValues(["a", "b"], { anyOf: ["a", "b"], noneOf: ["a"] }),
    ).toEqual(["b"])
  })

  it("возвращает пустой результат при несовместимых требованиях или пустом anyOf", () => {
    expect(filterSingleValues(["a", "b"], { allOf: ["a", "b"] })).toEqual([])
    expect(filterSingleValues<string, string>(["a"], { anyOf: [] })).toEqual([])
    expect(filterSingleValues(["a"], { allOf: ["a"], noneOf: ["a"] })).toEqual(
      [],
    )
  })
})
