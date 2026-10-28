import { describe, expect, it } from "@jest/globals"

import { removeEmptyTastePreferences } from "../core/removeEmptyTastePreferences"

describe("removeEmptyTastePreferences", () => {
  it("удаляет предпочтения без наблюдений и ручного веса", () => {
    expect(
      removeEmptyTastePreferences([
        {},
        { count: 0 },
        { explicitWeight: 0 },
        { count: 0, explicitWeight: 0 },
      ]),
    ).toEqual([])
  })

  it("сохраняет наблюдения и ручные веса обоих знаков в исходном порядке", () => {
    const observed = { count: 1, explicitWeight: 0 }
    const positive = { count: 0, explicitWeight: 0.5 }
    const negative = { explicitWeight: -0.5 }
    const preferences = [{ count: 0 }, observed, positive, negative]
    const result = removeEmptyTastePreferences(preferences)
    expect(result).toEqual([observed, positive, negative])
    expect(result[0]).toBe(observed)
    expect(preferences).toHaveLength(4)
  })

  it("возвращает пустой массив для пустого входа", () => {
    expect(removeEmptyTastePreferences([])).toEqual([])
  })

  it.each([null, undefined, "invalid", {}])(
    "не преобразует вход, не являющийся массивом: %j",
    (value) => {
      expect(removeEmptyTastePreferences(value as { count?: number }[])).toBe(
        value,
      )
    },
  )

  it("оставляет null и undefined для последующей валидации схемой", () => {
    const preferences = [null, undefined, { count: 0 }]
    expect(
      removeEmptyTastePreferences(preferences as { count?: number }[]),
    ).toEqual([null, undefined])
  })
})
