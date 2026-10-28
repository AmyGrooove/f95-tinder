import { describe, expect, it } from "@jest/globals"
import { Types } from "mongoose"

import { DICTIONARY } from "@entities/shared/static/DICTIONARY"

import { validateTagParents } from "../core/validateTagParents"

describe("validateTagParents", () => {
  it.each([
    undefined,
    [],
    [new Types.ObjectId()],
    ["000000000000000000000002"],
  ])(
    "принимает отсутствующих, пустых и корректных родителей: %j",
    (parents) => {
      expect(() =>
        validateTagParents({ id: "000000000000000000000001", parents }),
      ).not.toThrow()
    },
  )

  it.each([
    null,
    {},
    "000000000000000000000002",
    [null],
    [undefined],
    ["invalid"],
    [12],
  ])("отклоняет некорректный список родителей: %j", (parents) => {
    expect(() =>
      validateTagParents({ id: new Types.ObjectId(), parents }),
    ).toThrow(DICTIONARY.tag.invalidParents)
  })

  it("считает строку и ObjectId одного родителя дубликатами", () => {
    const parent = new Types.ObjectId()
    expect(() =>
      validateTagParents({
        id: new Types.ObjectId(),
        parents: [parent, parent.toHexString()],
      }),
    ).toThrow(DICTIONARY.tag.duplicateParents)
  })

  it.each([true, false])(
    "запрещает ссылку на себя для строкового и объектного ID: %s",
    (isString) => {
      const id = new Types.ObjectId()
      expect(() =>
        validateTagParents({ id, parents: [isString ? id.toHexString() : id] }),
      ).toThrow(DICTIONARY.tag.selfParent)
    },
  )

  it("сохраняет исходный массив родителей", () => {
    const parents = [new Types.ObjectId().toHexString()]
    const original = [...parents]
    validateTagParents({ id: new Types.ObjectId(), parents })
    expect(parents).toEqual(original)
  })
})
