import { describe, expect, it } from "@jest/globals"
import { plainToInstance } from "class-transformer"
import { validateSync } from "class-validator"

import { ELanguage } from "../../../schemas/ELanguage"
import { ESort } from "../../../types/ESort"
import { ESortDirection } from "../../../types/ESortDirection"
import { createSortDto } from "../core/createSortDto"

describe("createSortDto", () => {
  it("принимает допустимую сортировку, направление и язык для сортировки по названию", () => {
    const SortDto = createSortDto([ESort.TITLE, ESort.RATING])

    expect(validateSync(new SortDto())).toEqual([])
    expect(
      validateSync(
        plainToInstance(SortDto, {
          sort: ESort.TITLE,
          direction: ESortDirection.ASC,
          language: ELanguage.RUSSIAN,
        }),
      ),
    ).toEqual([])
  })

  it("отклоняет поля вне набора и язык при отсутствии сортировки по названию", () => {
    const SortDto = createSortDto([ESort.RATING])
    const errors = validateSync(
      plainToInstance(SortDto, {
        sort: ESort.TITLE,
        direction: "up",
        language: ELanguage.ENGLISH,
      }),
      { whitelist: true, forbidNonWhitelisted: true },
    )

    expect(errors).toHaveLength(3)
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: "sort",
          constraints: expect.objectContaining({ isIn: expect.any(String) }),
        }),
        expect.objectContaining({
          property: "direction",
          constraints: expect.objectContaining({ isEnum: expect.any(String) }),
        }),
        expect.objectContaining({
          property: "language",
          constraints: expect.objectContaining({
            whitelistValidation: expect.any(String),
          }),
        }),
      ]),
    )
  })

  it("валидирует язык, когда сортировка по названию доступна", () => {
    const SortDto = createSortDto([ESort.TITLE])
    expect(validateSync(plainToInstance(SortDto, { language: "fr" }))).toEqual([
      expect.objectContaining({
        property: "language",
        constraints: expect.objectContaining({ isEnum: expect.any(String) }),
      }),
    ])
  })
})
