import { describe, expect, it } from "@jest/globals"
import { Types } from "mongoose"

import { EItemType } from "../../../schemas/EItemType"
import { createItemFilterPipeline } from ".."

describe("createItemFilterPipeline", () => {
  it("по умолчанию исключает удалённые произведения", () => {
    expect(createItemFilterPipeline({})).toEqual([
      { $match: { deletedAt: null } },
    ])
  })

  it("сохраняет пустой список кандидатов как ограничение и совмещает его с исключениями и типом", () => {
    const excluded = new Types.ObjectId()

    expect(
      createItemFilterPipeline({
        filter: { types: [EItemType.SERIES], tagIds: [] },
        candidateItemIds: [],
        excludeItemIds: [excluded],
      }),
    ).toEqual([
      {
        $match: {
          deletedAt: null,
          type: { $in: [EItemType.SERIES] },
          _id: { $in: [], $nin: [excluded] },
        },
      },
    ])
  })
})
