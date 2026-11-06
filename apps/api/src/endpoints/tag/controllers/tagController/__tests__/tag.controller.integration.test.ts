import { describe, expect, it } from "@jest/globals"
import { Types } from "mongoose"

import { getSearchTestApplication } from "@app/__tests__/setup/setupSearchIntegration"
import { ETagGroup } from "@entities/tag/schemas/ETagGroup"
import { SyncTagSearchJobHandler } from "@endpoints/tag/services/syncTagSearchJobHandler"

describe("TagController", () => {
  const queryTags = (payload: object, origin = "http://localhost") => {
    return getSearchTestApplication().app.inject({
      method: "QUERY",
      url: "/tags",
      payload,
      headers: { origin },
    })
  }

  it("возвращает гостю теги нужной группы после синхронизации с MongoDB", async () => {
    const application = getSearchTestApplication()
    const id = new Types.ObjectId()
    await application.connection.collection("Tag").insertMany([
      {
        _id: id,
        key: "genreOrbit",
        group: ETagGroup.GENRE,
        name: { ru: "Орбита", en: null },
      },
      { key: "orbit", group: null, name: { ru: "Орбита", en: null } },
    ])
    expect((await queryTags({})).statusCode).toBe(503)

    await application.app.get(SyncTagSearchJobHandler).handle(null, {
      id: "tag-search-test",
      attempt: 1,
      updateProgress: async () => {},
      throwIfCancelled: async () => {},
    })

    const response = await queryTags({
      search: "Орбита",
      group: { allOf: [ETagGroup.GENRE] },
      limit: 10,
    })
    expect(response.statusCode).toBe(200)
    expect(response.headers["accept-query"]).toBe("application/json")
    expect(response.headers["cache-control"]).toBe("no-store")
    expect(response.json()).toEqual({
      items: [
        {
          id: id.toHexString(),
          key: "genreOrbit",
          group: ETagGroup.GENRE,
          name: { ru: "Орбита", en: null },
        },
      ],
      nextCursor: null,
    })
  })

  it("отклоняет некорректный фильтр и запрос с постороннего Origin", async () => {
    expect(
      (await queryTags({ group: { allOf: ["invalid"] } })).statusCode,
    ).toBe(400)
    expect((await queryTags({}, "https://foreign.example")).statusCode).toBe(
      403,
    )
  })
})
