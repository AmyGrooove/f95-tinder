import { describe, expect, it } from "@jest/globals"

import { createBriefUserItemProgress } from "../core/createBriefUserItemProgress"

describe("createBriefUserItemProgress", () => {
  it.each(["$latestAttempt", "$viewerItem.latestAttempt"])(
    "строит выражение для %s, сохраняющее нулевой прогресс и возвращающее null при отсутствии прогресса",
    (path) => {
      expect(createBriefUserItemProgress(path)).toEqual({
        $cond: [
          { $ne: [{ $ifNull: [path + ".progress", null] }, null] },
          { value: path + ".progress", unit: path + ".unit" },
          null,
        ],
      })
    },
  )
})
