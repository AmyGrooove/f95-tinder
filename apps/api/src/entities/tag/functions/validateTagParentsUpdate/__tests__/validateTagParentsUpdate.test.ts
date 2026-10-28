import { describe, expect, it } from "@jest/globals"
import { Types } from "mongoose"

import { DICTIONARY } from "@entities/shared/static/DICTIONARY"

import { validateTagParentsUpdate } from "../core/validateTagParentsUpdate"

describe("validateTagParentsUpdate", () => {
  it.each([
    undefined,
    null,
    1,
    {},
    { key: "genre" },
    { $set: { key: "genre" } },
    { $rename: { title: "name" } },
  ])("не ограничивает изменения без родителей: %j", (update) => {
    expect(() =>
      validateTagParentsUpdate({ id: undefined, update }),
    ).not.toThrow()
  })

  it.each(["parents", "$set", "$setOnInsert"])(
    "разрешает полную замену родителей через %s",
    (operator) => {
      const parents = [new Types.ObjectId()]
      const update =
        operator === "parents" ? { parents } : { [operator]: { parents } }
      expect(() =>
        validateTagParentsUpdate({
          id: new Types.ObjectId().toHexString(),
          update,
        }),
      ).not.toThrow()
    },
  )

  it.each([
    [],
    [{ $set: { parents: [] } }],
    { $push: { parents: new Types.ObjectId() } },
    { $addToSet: { parents: new Types.ObjectId() } },
    { $pull: { parents: new Types.ObjectId() } },
    { $unset: { parents: 1 } },
    { $set: { "parents.0": new Types.ObjectId() } },
    { "parents.0": new Types.ObjectId() },
    { $rename: { name: "parents" } },
    { $rename: { name: "parents.0" } },
    { $rename: { parents: "name" } },
  ])("отклоняет неподдерживаемую запись родителей: %j", (update) => {
    expect(() =>
      validateTagParentsUpdate({ id: new Types.ObjectId(), update }),
    ).toThrow(DICTIONARY.tag.unsupportedParentsWrite)
  })

  it.each([undefined, null, "invalid", {}])(
    "требует конкретный ID при замене родителей: %j",
    (id) => {
      expect(() =>
        validateTagParentsUpdate({ id, update: { $set: { parents: [] } } }),
      ).toThrow(DICTIONARY.tag.unsupportedParentsWrite)
    },
  )

  it("передаёт ошибки проверки списка родителей", () => {
    const id = new Types.ObjectId()
    expect(() =>
      validateTagParentsUpdate({ id, update: { $set: { parents: [id] } } }),
    ).toThrow(DICTIONARY.tag.selfParent)
    expect(() =>
      validateTagParentsUpdate({ id, update: { parents: ["invalid"] } }),
    ).toThrow(DICTIONARY.tag.invalidParents)
    const parent = new Types.ObjectId()
    expect(() =>
      validateTagParentsUpdate({
        id,
        update: { $setOnInsert: { parents: [parent, parent] } },
      }),
    ).toThrow(DICTIONARY.tag.duplicateParents)
  })
})
