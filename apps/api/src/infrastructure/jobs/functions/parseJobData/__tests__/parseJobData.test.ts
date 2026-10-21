import { describe, expect, it } from "@jest/globals"

import { parseJobData } from "../core/parseJobData"
import { DICTIONARY } from "@shared/static/DICTIONARY"

describe("parseJobData", () => {
  it.each(["none", "cancelling", "cancelled"])(
    "принимает корректную оболочку с состоянием отмены %s",
    (cancellationState) => {
      const value = {
        name: "sync",
        version: 1,
        payload: { id: 1 },
        retryDelays: [0, 1000],
        cancellationState,
      }

      expect(parseJobData({ ...value, extra: "ignored" })).toStrictEqual(value)
    },
  )

  it.each([undefined, null, false, 0, "", []])(
    "принимает произвольную полезную нагрузку %s",
    (payload) => {
      expect(
        parseJobData({
          name: "sync",
          version: 1,
          payload,
          retryDelays: [],
          cancellationState: "none",
        }).payload,
      ).toBe(payload)
    },
  )

  it.each(["name", "version", "payload", "retryDelays", "cancellationState"])(
    "требует поле %s",
    (key) => {
      const value: Record<string, unknown> = {
        name: "sync",
        version: 1,
        payload: null,
        retryDelays: [],
        cancellationState: "none",
      }
      delete value[key]

      expect(() => parseJobData(value)).toThrow(
        DICTIONARY.jobs.invalidPersistedData,
      )
    },
  )

  it.each([
    { name: "" },
    { name: 1 },
    { version: 0 },
    { version: -1 },
    { version: 1.5 },
    { version: "1" },
    { version: Number.NaN },
    { version: Infinity },
    { retryDelays: "0" },
    { retryDelays: [-1] },
    { retryDelays: [0.5] },
    { retryDelays: ["0"] },
    { retryDelays: [Infinity] },
    { cancellationState: "unknown" },
    { cancellationState: null },
  ])("отклоняет некорректные поля %j", (invalid) => {
    expect(() =>
      parseJobData({
        name: "sync",
        version: 1,
        payload: null,
        retryDelays: [],
        cancellationState: "none",
        ...invalid,
      }),
    ).toThrow(DICTIONARY.jobs.invalidPersistedData)
  })

  it.each([undefined, null, 0, "sync", []])(
    "отклоняет значение без оболочки %s",
    (value) => {
      expect(() => parseJobData(value)).toThrow(
        DICTIONARY.jobs.invalidPersistedData,
      )
    },
  )
})
