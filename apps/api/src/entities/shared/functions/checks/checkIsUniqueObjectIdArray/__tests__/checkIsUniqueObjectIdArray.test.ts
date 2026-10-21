import { describe, expect, it } from "@jest/globals"
import { Types } from "mongoose"

import { checkIsUniqueObjectIdArray } from "../core/checkIsUniqueObjectIdArray"

describe("checkIsUniqueObjectIdArray", () => {
  it("принимает пустой массив", () => {
    expect(checkIsUniqueObjectIdArray([])).toBe(true)
  })

  it("принимает различные ObjectId", () => {
    expect(
      checkIsUniqueObjectIdArray([
        new Types.ObjectId("000000000000000000000001"),
        new Types.ObjectId("000000000000000000000002"),
      ]),
    ).toBe(true)
  })

  it("отклоняет повтор одного объекта", () => {
    const id = new Types.ObjectId()

    expect(checkIsUniqueObjectIdArray([id, id])).toBe(false)
  })

  it("отклоняет разные объекты с одинаковым ObjectId", () => {
    expect(
      checkIsUniqueObjectIdArray([
        new Types.ObjectId("000000000000000000000001"),
        new Types.ObjectId("000000000000000000000001"),
      ]),
    ).toBe(false)
  })

  it.each(
    [
      null,
      undefined,
      {},
      "text",
      [null],
      [undefined],
      [new Types.ObjectId(), null],
    ].map((value) => ({ value })),
  )(
    "отклоняет не массив или массив с null либо undefined: $value",
    ({ value }) => {
      expect(checkIsUniqueObjectIdArray(value as Types.ObjectId[])).toBe(false)
    },
  )

  it("сохраняет исходный порядок и ссылки на ObjectId", () => {
    const first = new Types.ObjectId("000000000000000000000002")
    const second = new Types.ObjectId("000000000000000000000001")
    const value = [first, second]

    expect(checkIsUniqueObjectIdArray(value)).toBe(true)
    expect(value[0]).toBe(first)
    expect(value[1]).toBe(second)
  })
})
