import { describe, expect, it } from "@jest/globals"

import { ECollectionBlockType } from "@entities/collection/schemas/ECollectionBlockType"
import { createPaginatedResult } from "@shared/functions/pagination/createPaginatedResult"

import { createCollectionDisplayBlocks } from "../core/createCollectionDisplayBlocks"
import { COLLECTION_DISPLAY_BLOCKS_PROPS } from "./static/COLLECTION_DISPLAY_BLOCKS_PROPS"

describe("createCollectionDisplayBlocks", () => {
  it("сохраняет порядок блоков, пропускает пустую группу и привязывает тексты к следующей непустой группе", () => {
    expect(
      createCollectionDisplayBlocks(COLLECTION_DISPLAY_BLOCKS_PROPS),
    ).toEqual([
      {
        id: "000000000000000000000001",
        type: "text",
        content: { ru: "Текст", en: "Text" },
        beforeItemId: "item-1",
      },
      {
        id: "000000000000000000000002",
        type: "group",
        title: { ru: "Группа", en: "Group" },
        description: { ru: "Описание", en: null },
        beforeItemId: "item-1",
      },
      {
        id: "000000000000000000000003",
        type: "text",
        content: { ru: "Текст", en: "Text" },
        beforeItemId: "item-4",
      },
      {
        id: "000000000000000000000005",
        type: "text",
        content: { ru: "Текст", en: "Text" },
        beforeItemId: "item-4",
      },
      {
        id: "000000000000000000000006",
        type: "group",
        title: { ru: "Группа", en: "Group" },
        description: { ru: "Описание", en: null },
        beforeItemId: "item-4",
      },
      {
        id: "000000000000000000000007",
        type: "text",
        content: { ru: "Текст", en: "Text" },
        beforeItemId: null,
      },
    ])
  })

  it.each([
    { page: 1, start: 0, ids: [1, 2], anchors: ["item-1", "item-1"] },
    {
      page: 2,
      start: 2,
      ids: [2, 3, 5, 6],
      anchors: ["item-3", "item-4", "item-4", "item-4"],
    },
    { page: 3, start: 4, ids: [6, 7], anchors: ["item-5", null] },
    { page: 4, start: 6, ids: [], anchors: [] },
  ])(
    "выбирает блоки страницы $page и повторяет заголовки при продолжении группы",
    ({ page, start, ids, anchors }) => {
      const result = createCollectionDisplayBlocks({
        ...COLLECTION_DISPLAY_BLOCKS_PROPS,
        page: createPaginatedResult(
          COLLECTION_DISPLAY_BLOCKS_PROPS.page.items.slice(start, start + 2),
          5,
          page,
          2,
        ),
      })

      expect(result.map((block) => block.id)).toEqual(
        ids.map((id) => id.toString().padStart(24, "0")),
      )
      expect(result.map((block) => block.beforeItemId)).toEqual(anchors)
    },
  )

  it("переносит текст на следующую страницу при точном совпадении с её началом", () => {
    const first = createCollectionDisplayBlocks({
      ...COLLECTION_DISPLAY_BLOCKS_PROPS,
      page: createPaginatedResult(
        COLLECTION_DISPLAY_BLOCKS_PROPS.page.items.slice(0, 3),
        5,
        1,
        3,
      ),
    })
    const second = createCollectionDisplayBlocks({
      ...COLLECTION_DISPLAY_BLOCKS_PROPS,
      page: createPaginatedResult(
        COLLECTION_DISPLAY_BLOCKS_PROPS.page.items.slice(3),
        5,
        2,
        3,
      ),
    })

    expect(first.map((block) => block.id)).toEqual([
      "000000000000000000000001",
      "000000000000000000000002",
    ])
    expect(second.map((block) => [block.id, block.beforeItemId])).toEqual([
      ["000000000000000000000003", "item-4"],
      ["000000000000000000000005", "item-4"],
      ["000000000000000000000006", "item-4"],
      ["000000000000000000000007", null],
    ])
  })

  it("скрывает все тексты при фильтрации, сохраняя заголовки и их якоря", () => {
    expect(
      createCollectionDisplayBlocks({
        ...COLLECTION_DISPLAY_BLOCKS_PROPS,
        isFiltered: true,
      }),
    ).toEqual([
      {
        id: "000000000000000000000002",
        type: "group",
        title: { ru: "Группа", en: "Group" },
        description: { ru: "Описание", en: null },
        beforeItemId: "item-1",
      },
      {
        id: "000000000000000000000006",
        type: "group",
        title: { ru: "Группа", en: "Group" },
        description: { ru: "Описание", en: null },
        beforeItemId: "item-4",
      },
    ])
  })

  it.each([
    { page: 1, isFiltered: false, ids: [1, 3, 5, 7] },
    { page: 2, isFiltered: false, ids: [] },
    { page: 1, isFiltered: true, ids: [] },
  ])(
    "показывает тексты пустой подборки только на первой странице без фильтрации: $page, $isFiltered",
    ({ page, isFiltered, ids }) => {
      const result = createCollectionDisplayBlocks({
        ...COLLECTION_DISPLAY_BLOCKS_PROPS,
        groupCounts: [],
        page: createPaginatedResult([], 0, page, 2),
        isFiltered,
      })

      expect(result).toEqual(
        ids.map((id) => ({
          id: id.toString().padStart(24, "0"),
          type: "text",
          content: { ru: "Текст", en: "Text" },
          beforeItemId: null,
        })),
      )
    },
  )

  it("возвращает пустой список при отсутствии блоков", () => {
    expect(
      createCollectionDisplayBlocks({
        ...COLLECTION_DISPLAY_BLOCKS_PROPS,
        blocks: [],
      }),
    ).toEqual([])
  })

  it("сохраняет null в заголовке и описании группы", () => {
    const result = createCollectionDisplayBlocks({
      ...COLLECTION_DISPLAY_BLOCKS_PROPS,
      blocks: [
        {
          id: COLLECTION_DISPLAY_BLOCKS_PROPS.groupCounts[0].groupId,
          type: ECollectionBlockType.GROUP,
          title: null,
          description: null,
          content: null,
        },
      ],
    })

    expect(result).toEqual([
      {
        id: "000000000000000000000002",
        type: "group",
        title: null,
        description: null,
        beforeItemId: "item-1",
      },
    ])
  })

  it.each([null, { ru: null, en: "Text" }, { ru: "", en: null }])(
    "нормализует отсутствующее содержимое текста и сохраняет языковые значения %p",
    (content) => {
      const result = createCollectionDisplayBlocks({
        ...COLLECTION_DISPLAY_BLOCKS_PROPS,
        blocks: [
          {
            id: COLLECTION_DISPLAY_BLOCKS_PROPS.blocks[0].id,
            type: ECollectionBlockType.TEXT,
            title: null,
            description: null,
            content,
          },
        ],
      })

      expect(result).toEqual([
        {
          id: "000000000000000000000001",
          type: "text",
          content: content ?? { ru: null, en: null },
          beforeItemId: "item-1",
        },
      ])
    },
  )

  it("не изменяет входные блоки, счётчики и страницу", () => {
    const before = JSON.stringify(COLLECTION_DISPLAY_BLOCKS_PROPS)

    createCollectionDisplayBlocks(COLLECTION_DISPLAY_BLOCKS_PROPS)

    expect(JSON.stringify(COLLECTION_DISPLAY_BLOCKS_PROPS)).toBe(before)
  })
})
