import { describe, expect, it } from "@jest/globals"

import { isDate } from ".."

describe("isDate", () => {
  it.each(
    [
      new Date(0),
      new Date(-1),
      new Date("2026-01-01T00:00:00Z"),
      new Date(-8_640_000_000_000_000),
      new Date(8_640_000_000_000_000),
    ].map((value) => ({ value })),
  )("возвращает true для валидной даты $value", ({ value }) => {
    expect(isDate(value)).toBe(true)
  })

  it.each(
    [
      new Date(Number.NaN),
      new Date("invalid"),
      new Date(Infinity),
      new Date(-8_640_000_000_000_001),
      new Date(8_640_000_000_000_001),
    ].map((value) => ({ value })),
  )("возвращает false для невалидной даты $value", ({ value }) => {
    expect(isDate(value)).toBe(false)
  })

  it.each(
    [
      undefined,
      null,
      true,
      false,
      0,
      1_767_225_600_000,
      Number.NaN,
      "2026-01-01",
      0n,
      Symbol("date"),
      {},
      [],
      { getTime: () => 0 },
      () => new Date(0),
    ].map((value) => ({ value })),
  )("возвращает false для значения другого типа $value", ({ value }) => {
    expect(isDate(value)).toBe(false)
  })
})
