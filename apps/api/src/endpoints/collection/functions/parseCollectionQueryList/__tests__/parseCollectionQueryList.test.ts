import { describe, expect, it } from "@jest/globals"

import { parseCollectionQueryList } from "../core/parseCollectionQueryList"

describe("parseCollectionQueryList", () => {
  it.each([
    { value: "movie", expected: ["movie"] },
    { value: " movie, anime ,game ", expected: ["movie", "anime", "game"] },
    { value: "\t movie\n,\tgame\r\n", expected: ["movie", "game"] },
    {
      value: [" movie,anime ", " game "],
      expected: ["movie", "anime", "game"],
    },
    { value: [], expected: [] },
    { value: "", expected: [""] },
    { value: " ,movie,, ", expected: ["", "movie", "", ""] },
    { value: ["", " "], expected: ["", ""] },
    { value: "movie,movie", expected: ["movie", "movie"] },
  ])(
    "разбирает $value с сохранением порядка и пустых частей",
    ({ value, expected }) => {
      expect(parseCollectionQueryList(value)).toEqual(expected)
    },
  )

  it.each([undefined, null, 0, 42, false, true, { value: "movie,game" }])(
    "сохраняет нестроковое значение %p без преобразования",
    (value) => {
      const result = parseCollectionQueryList(value)

      expect(result).toHaveLength(1)
      expect(result[0]).toBe(value)
    },
  )

  it("разбирает только строки верхнего уровня смешанного массива", () => {
    const object = { value: "movie,game" }
    const nested = ["movie,game"]
    const input = Object.freeze([" movie,game ", null, 12, object, nested])
    const result = parseCollectionQueryList(input)

    expect(result).toEqual(["movie", "game", null, 12, object, nested])
    expect(result[4]).toBe(object)
    expect(result[5]).toBe(nested)
    expect(input).toEqual([" movie,game ", null, 12, object, ["movie,game"]])
  })

  it("создаёт новый массив, не изменяя исходный список строк", () => {
    const input = Object.freeze([" movie,game ", " anime "])

    expect(parseCollectionQueryList(input)).toEqual(["movie", "game", "anime"])
    expect(input).toEqual([" movie,game ", " anime "])
  })
})
