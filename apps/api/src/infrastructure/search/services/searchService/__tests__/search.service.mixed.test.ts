import {
  beforeEach,
  describe,
  expect,
  it,
  jest,
  afterAll,
  beforeAll,
} from "@jest/globals"
import {
  ErrorStatusCode,
  Meilisearch,
  MeilisearchApiError,
  type EnqueuedTask,
} from "meilisearch"
import { DICTIONARY } from "@shared/static/DICTIONARY"
import { SearchService } from "../core/search.service"
import { randomUUID } from "node:crypto"
import { Test, type TestingModule } from "@nestjs/testing"
import { createTestMeilisearch } from "@infrastructure/search/__tests__/setup/createTestMeilisearch"
import { infrastructureConfiguration } from "@infrastructure/config/config.module"
import { SearchModule } from "../../../search.module"
import { SEARCH_CLIENT } from "../../../static/SEARCH_CLIENT"

if (Reflect.get(globalThis, "IS_INTEGRATION_TEST") === true) {
  describe("SearchService", () => {
    const options = {
      displayedAttributes: ["id", "title", "genre", "year"],
      filterableAttributes: ["genre"],
      rankingRules: [
        "words",
        "typo",
        "proximity",
        "attribute",
        "sort",
        "exactness",
      ],
      searchableAttributes: ["title"],
      sortableAttributes: ["year"],
    }
    const documents = [
      {
        id: "dune",
        title: "Dune",
        genre: "fiction",
        year: 1965,
        secret: "hidden",
      },
      { id: "foundation", title: "Foundation", genre: "fiction", year: 1951 },
      { id: "cosmos", title: "Cosmos", genre: "science", year: 1980 },
    ]
    let meilisearch:
      Awaited<ReturnType<typeof createTestMeilisearch>> | undefined
    let moduleRef: TestingModule | undefined
    let client: Meilisearch
    let service: SearchService
    let indexName: string

    beforeAll(async () => {
      meilisearch = await createTestMeilisearch()
      moduleRef = await Test.createTestingModule({ imports: [SearchModule] })
        .overrideProvider(infrastructureConfiguration.KEY)
        .useValue({ search: meilisearch.configuration })
        .compile()
      await moduleRef.init()
      service = moduleRef.get(SearchService)
      client = moduleRef.get(SEARCH_CLIENT)
    }, 240_000)

    beforeEach(() => {
      indexName = `books-${randomUUID()}`
    })

    afterAll(async () => {
      try {
        await moduleRef?.close()
      } finally {
        await meilisearch?.close()
      }
    }, 60_000)

    const seed = async () => {
      await service.ensureIndex(indexName, options, true)
      await service.upsert(indexName, documents, true)
    }

    it("создаёт индекс с ключом id и применяет все настройки до возврата", async () => {
      await service.ensureIndex(indexName, options, true)

      const index = await client.getIndex(indexName)
      expect(index.primaryKey).toBe("id")
      await expect(index.getSettings()).resolves.toEqual(
        expect.objectContaining(options),
      )
    })

    it("обновляет настройки существующего индекса и сохраняет документы", async () => {
      await seed()

      await service.ensureIndex(
        indexName,
        { searchableAttributes: ["title", "genre"] },
        true,
      )

      await expect(client.index(indexName).getSettings()).resolves.toEqual(
        expect.objectContaining({
          searchableAttributes: ["title", "genre"],
          filterableAttributes: ["genre"],
          sortableAttributes: ["year"],
        }),
      )
      expect((await service.search(indexName, "")).estimatedTotalHits).toBe(3)
    })

    it("создаёт один работоспособный индекс при параллельных вызовах", async () => {
      await Promise.all([
        service.ensureIndex(indexName, options, true),
        service.ensureIndex(indexName, options, true),
        service.ensureIndex(indexName, options),
      ])
      await service.upsert(indexName, documents, true)

      expect((await service.search(indexName, "Dune")).hits).toEqual([
        { id: "dune", title: "Dune", genre: "fiction", year: 1965 },
      ])
    })

    it("индексирует документы, выполняет полнотекстовый поиск и возвращает метаданные", async () => {
      await seed()

      const result = await service.search(indexName, "Dune")

      expect(result).toEqual({
        hits: [{ id: "dune", title: "Dune", genre: "fiction", year: 1965 }],
        estimatedTotalHits: 1,
        limit: 20,
        offset: 0,
        processingTimeMs: expect.any(Number),
        query: "Dune",
      })
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0)
    })

    it("применяет фильтрацию, сортировку, пагинацию и выбор возвращаемых полей", async () => {
      await seed()

      await expect(
        service.search(indexName, "", {
          filter: "genre = fiction",
          sort: ["year:desc"],
          limit: 1,
          offset: 1,
          attributesToRetrieve: ["id", "title"],
        }),
      ).resolves.toEqual({
        hits: [{ id: "foundation", title: "Foundation" }],
        estimatedTotalHits: 2,
        limit: 1,
        offset: 1,
        processingTimeMs: expect.any(Number),
        query: "",
      })
    })

    it("возвращает пустой результат для запроса без совпадений", async () => {
      await seed()

      await expect(service.search(indexName, "zzzzzzzzzzzz")).resolves.toEqual(
        expect.objectContaining({
          hits: [],
          estimatedTotalHits: 0,
        }),
      )
    })

    it("заменяет документ с тем же id без создания дубликата", async () => {
      await seed()

      await service.upsert(
        indexName,
        [{ id: "dune", title: "Arrakis", year: 2026 }],
        true,
      )

      await expect(
        client.index(indexName).getDocument("dune"),
      ).resolves.toStrictEqual({ id: "dune", title: "Arrakis", year: 2026 })
      expect((await service.search(indexName, "")).estimatedTotalHits).toBe(3)
      expect((await service.search(indexName, "Dune")).hits).toEqual([])
      expect((await service.search(indexName, "Arrakis")).hits).toEqual([
        { id: "dune", title: "Arrakis", year: 2026 },
      ])
    })

    it("удаляет выбранный документ, сохраняя остальные", async () => {
      await seed()

      await service.delete(indexName, "dune", true)

      expect((await service.search(indexName, "Dune")).hits).toEqual([])
      expect(
        (await service.search(indexName, "")).hits.map(({ id }) => id).sort(),
      ).toEqual(["cosmos", "foundation"])
    })

    it("проверяет существование индекса без его создания", async () => {
      await expect(service.hasIndex(indexName)).resolves.toBe(false)
      await seed()
      await expect(service.hasIndex(indexName)).resolves.toBe(true)
      expect((await service.search(indexName, "")).estimatedTotalHits).toBe(3)
    })

    it("обходит все совпадения за пределами поискового лимита с фильтром и оценкой релевантности", async () => {
      await service.ensureIndex(
        indexName,
        {
          ...options,
          filterableAttributes: ["id", "genre"],
          pagination: { maxTotalHits: 2 },
        },
        true,
      )
      await service.upsert(
        indexName,
        [
          ...documents,
          { id: "dune-2", title: "Dune Messiah", genre: "fiction", year: 1969 },
          {
            id: "dune-3",
            title: "Children of Dune",
            genre: "fiction",
            year: 1976,
          },
          {
            id: "dune-science",
            title: "Dune Science",
            genre: "science",
            year: 2026,
          },
        ],
        true,
      )
      const matches = []

      for await (const batch of service.iterateMatches({
        index: indexName,
        query: "Dune",
        filter: ["genre = fiction"],
        batchSize: 2,
      })) {
        matches.push(...batch)
      }

      expect(matches.map(({ id }) => id).sort()).toStrictEqual([
        "dune",
        "dune-2",
        "dune-3",
      ])
      for (const match of matches) {
        expect(match).toStrictEqual({
          id: expect.any(String),
          _rankingScore: expect.any(Number),
        })
        expect(match._rankingScore).toBeGreaterThan(0)
        expect(match._rankingScore).toBeLessThanOrEqual(1)
      }
    })

    it("удаляет несколько выбранных документов и сохраняет остальные", async () => {
      await seed()

      await service.deleteMany(indexName, ["dune", "cosmos", "missing"])

      expect((await service.search(indexName, "")).hits).toStrictEqual([
        { id: "foundation", title: "Foundation", genre: "fiction", year: 1951 },
      ])
    })

    it("позволяет удалить отсутствующий документ", async () => {
      await seed()

      await expect(
        service.delete(indexName, "missing", true),
      ).resolves.toBeUndefined()
      expect((await service.search(indexName, "")).estimatedTotalHits).toBe(3)
    })

    it("очищает документы, сохраняя индекс и его настройки для повторной записи", async () => {
      await seed()

      await service.clear(indexName, true)

      expect((await service.search(indexName, "")).hits).toEqual([])
      await expect(client.index(indexName).getSettings()).resolves.toEqual(
        expect.objectContaining(options),
      )
      await service.upsert(indexName, [{ id: "new", title: "New book" }], true)
      expect((await service.search(indexName, "New")).hits).toEqual([
        { id: "new", title: "New book" },
      ])
    })

    it("передаёт ошибку отсутствующего индекса от Meilisearch", async () => {
      await expect(service.search(indexName, "Dune")).rejects.toMatchObject({
        cause: { code: ErrorStatusCode.INDEX_NOT_FOUND },
      })
    })

    it("передаёт ошибку фильтра по неразрешённому полю от Meilisearch", async () => {
      await seed()

      await expect(
        service.search(indexName, "", { filter: "year = 1965" }),
      ).rejects.toMatchObject({
        cause: { code: ErrorStatusCode.INVALID_SEARCH_FILTER },
      })
    })
  })
} else {
  describe("SearchService", () => {
    const client = new Meilisearch({ host: "http://127.0.0.1:1" })
    const index = client.index("books")
    const task: EnqueuedTask = {
      taskUid: 42,
      indexUid: "books",
      status: "enqueued",
      type: "settingsUpdate",
      enqueuedAt: "2026-01-01T00:00:00Z",
    }
    const options = {
      displayedAttributes: ["id", "title"],
      filterableAttributes: ["genre"],
      rankingRules: [
        "words",
        "typo",
        "proximity",
        "attribute",
        "sort",
        "exactness",
      ],
      searchableAttributes: ["title"],
      sortableAttributes: ["year"],
      pagination: { maxTotalHits: 10_000 },
      typoTolerance: { enabled: false },
    }
    const createApiError = (code = ErrorStatusCode.INDEX_NOT_FOUND) => {
      return new MeilisearchApiError(new Response(null, { status: 404 }), {
        code,
        message: "Search request failed",
        type: "invalid_request",
        link: "https://docs.meilisearch.com/errors",
      })
    }
    const setup = () => {
      jest.spyOn(client, "index").mockReturnValue(index)

      return {
        service: new SearchService(client),
        getIndex: jest.spyOn(client, "getIndex").mockResolvedValue(index),
        createIndex: jest.spyOn(client, "createIndex").mockResolvedValue(task),
        updateSettings: jest
          .spyOn(index, "updateSettings")
          .mockResolvedValue(task),
        addDocuments: jest.spyOn(index, "addDocuments").mockResolvedValue(task),
        deleteDocument: jest
          .spyOn(index, "deleteDocument")
          .mockResolvedValue(task),
        deleteAllDocuments: jest
          .spyOn(index, "deleteAllDocuments")
          .mockResolvedValue(task),
        search: jest.spyOn(index, "search"),
        getDocuments: jest.spyOn(index, "getDocuments"),
        deleteDocuments: jest
          .spyOn(index, "deleteDocuments")
          .mockResolvedValue(task),
        waitForTask: jest.spyOn(client.tasks, "waitForTask").mockResolvedValue({
          ...task,
          uid: task.taskUid,
          status: "succeeded",
          batchUid: null,
          canceledBy: null,
          error: null,
          duration: null,
          startedAt: null,
          finishedAt: null,
        }),
      }
    }
    let context: ReturnType<typeof setup>

    beforeEach(() => {
      context = setup()
    })

    describe("ensureIndex", () => {
      it("применяет настройки существующего индекса без его создания и ожидания задачи", async () => {
        await expect(
          context.service.ensureIndex("books", options),
        ).resolves.toBeUndefined()

        expect(context.getIndex).toHaveBeenCalledWith("books")
        expect(context.createIndex).not.toHaveBeenCalled()
        expect(client.index).toHaveBeenCalledWith("books")
        expect(context.updateSettings).toHaveBeenCalledWith(options)
        expect(context.waitForTask).not.toHaveBeenCalled()
      })

      it("создаёт отсутствующий индекс с первичным ключом id и применяет настройки", async () => {
        context.getIndex.mockRejectedValueOnce(createApiError())

        await context.service.ensureIndex("books", options, true)

        expect(context.createIndex).toHaveBeenCalledWith("books", {
          primaryKey: "id",
        })
        expect(context.updateSettings).toHaveBeenCalledWith(options)
        expect(context.waitForTask).toHaveBeenCalledWith(task.taskUid, {
          timeout: 120_000,
        })
      })

      it("поддерживает отсутствие необязательных настроек", async () => {
        await context.service.ensureIndex("books", {})

        expect(context.updateSettings).toHaveBeenCalledWith({
          displayedAttributes: undefined,
          filterableAttributes: undefined,
          rankingRules: undefined,
          searchableAttributes: undefined,
          sortableAttributes: undefined,
          pagination: undefined,
          typoTolerance: undefined,
        })
      })

      it("объединяет параллельные инициализации одного индекса и учитывает ожидание каждого вызова", async () => {
        context.getIndex.mockRejectedValueOnce(createApiError())

        await Promise.all([
          context.service.ensureIndex("books", options),
          context.service.ensureIndex("books", options, true),
          context.service.ensureIndex("books", options, true),
        ])

        expect(context.getIndex).toHaveBeenCalledTimes(1)
        expect(context.createIndex).toHaveBeenCalledTimes(1)
        expect(context.updateSettings).toHaveBeenCalledTimes(1)
        expect(context.waitForTask).toHaveBeenCalledTimes(2)
      })

      it("инициализирует разные индексы независимо", async () => {
        await Promise.all([
          context.service.ensureIndex("books", options),
          context.service.ensureIndex("films", {}),
        ])

        expect(context.getIndex).toHaveBeenCalledTimes(2)
        expect(context.getIndex).toHaveBeenCalledWith("films")
        expect(client.index).toHaveBeenCalledWith("films")
        expect(context.updateSettings).toHaveBeenCalledTimes(2)
      })

      it("повторно применяет настройки после завершения предыдущей инициализации", async () => {
        await context.service.ensureIndex("books", options)
        await context.service.ensureIndex("books", {
          searchableAttributes: ["description"],
        })

        expect(context.getIndex).toHaveBeenCalledTimes(2)
        expect(context.updateSettings).toHaveBeenLastCalledWith(
          expect.objectContaining({ searchableAttributes: ["description"] }),
        )
      })

      it.each([
        new Error("Connection failed"),
        createApiError(ErrorStatusCode.INVALID_API_KEY),
        new MeilisearchApiError(new Response(null, { status: 500 })),
        { cause: { code: ErrorStatusCode.INDEX_NOT_FOUND } },
      ])(
        "передаёт ошибку чтения индекса вызывающему коду без попытки создания: %p",
        async (error) => {
          context.getIndex.mockRejectedValueOnce(error)

          await expect(
            context.service.ensureIndex("books", options),
          ).rejects.toBe(error)
          expect(context.createIndex).not.toHaveBeenCalled()
          expect(context.updateSettings).not.toHaveBeenCalled()
        },
      )

      it("передаёт ошибку создания индекса без применения настроек", async () => {
        const error = new Error("Creation failed")
        context.getIndex.mockRejectedValueOnce(createApiError())
        context.createIndex.mockRejectedValueOnce(error)

        await expect(
          context.service.ensureIndex("books", options),
        ).rejects.toBe(error)
        expect(context.updateSettings).not.toHaveBeenCalled()
      })

      it("позволяет повторить инициализацию после ошибки применения настроек", async () => {
        const error = new Error("Settings failed")
        context.updateSettings.mockRejectedValueOnce(error)

        await expect(
          context.service.ensureIndex("books", options),
        ).rejects.toBe(error)
        await expect(
          context.service.ensureIndex("books", options),
        ).resolves.toBeUndefined()
        expect(context.updateSettings).toHaveBeenCalledTimes(2)
      })
    })

    describe("search", () => {
      it.each([9, 0, undefined])(
        "возвращает документы и метаданные с estimatedTotalHits=%p",
        async (estimatedTotalHits) => {
          const hits = [{ id: "book-1", title: "Dune" }]
          context.search.mockResolvedValueOnce({
            hits,
            estimatedTotalHits,
            limit: 5,
            offset: 2,
            processingTimeMs: 3,
            query: "dune",
            facetDistribution: { genre: { fiction: 1 } },
          })
          const queryOptions = {
            limit: 5,
            offset: 2,
            filter: "genre = fiction",
            sort: ["year:desc"],
            attributesToRetrieve: ["id", "title"],
            attributesToCrop: ["title"],
            cropLength: 10,
          }

          await expect(
            context.service.search("books", "dune", queryOptions),
          ).resolves.toStrictEqual({
            hits,
            estimatedTotalHits: estimatedTotalHits ?? hits.length,
            limit: 5,
            offset: 2,
            processingTimeMs: 3,
            query: "dune",
          })
          expect(client.index).toHaveBeenCalledWith("books")
          expect(context.search).toHaveBeenCalledWith("dune", queryOptions)
        },
      )

      it("поддерживает запрос без опций и пустую выдачу без оценки количества", async () => {
        context.search.mockResolvedValueOnce({
          hits: [],
          limit: 20,
          offset: 0,
          processingTimeMs: 0,
          query: "missing",
        })

        await expect(
          context.service.search("books", "missing"),
        ).resolves.toStrictEqual({
          hits: [],
          estimatedTotalHits: 0,
          limit: 20,
          offset: 0,
          processingTimeMs: 0,
          query: "missing",
        })
        expect(context.search).toHaveBeenCalledWith("missing", undefined)
      })

      it("передаёт ошибку поиска вызывающему коду", async () => {
        const error = new Error("Search failed")
        context.search.mockRejectedValueOnce(error)

        await expect(context.service.search("books", "dune")).rejects.toBe(
          error,
        )
      })
    })

    describe("hasIndex", () => {
      it("возвращает true для существующего индекса", async () => {
        await expect(context.service.hasIndex("books")).resolves.toBe(true)
        expect(context.getIndex).toHaveBeenCalledWith("books")
        expect(context.createIndex).not.toHaveBeenCalled()
      })

      it("возвращает false для отсутствующего индекса без его создания", async () => {
        context.getIndex.mockRejectedValueOnce(createApiError())

        await expect(context.service.hasIndex("books")).resolves.toBe(false)
        expect(context.createIndex).not.toHaveBeenCalled()
      })

      it.each([
        new Error("Connection failed"),
        createApiError(ErrorStatusCode.INVALID_API_KEY),
        { cause: { code: ErrorStatusCode.INDEX_NOT_FOUND } },
      ])("не маскирует ошибку проверки индекса %p", async (error) => {
        context.getIndex.mockRejectedValueOnce(error)

        await expect(context.service.hasIndex("books")).rejects.toBe(error)
      })
    })

    describe("readDocumentIds", () => {
      it("читает только id заданной страницы документов в исходном порядке", async () => {
        context.getDocuments.mockResolvedValueOnce({
          results: [{ id: "second" }, { id: "first" }],
          offset: 5,
          limit: 2,
          total: 7,
        })

        await expect(
          context.service.readDocumentIds("books", { offset: 5, limit: 2 }),
        ).resolves.toStrictEqual(["second", "first"])
        expect(client.index).toHaveBeenCalledWith("books")
        expect(context.getDocuments).toHaveBeenCalledWith({
          fields: ["id"],
          offset: 5,
          limit: 2,
        })
      })

      it("передаёт ошибку чтения документов", async () => {
        const error = new Error("Documents unavailable")
        context.getDocuments.mockRejectedValueOnce(error)

        await expect(
          context.service.readDocumentIds("books", { offset: 0, limit: 2 }),
        ).rejects.toBe(error)
      })
    })

    describe("iterateMatches", () => {
      it("продолжает обход после пустой выдачи и сдвигает страницу по числу документов", async () => {
        context.getDocuments
          .mockResolvedValueOnce({
            results: [{ id: "first" }, { id: 'quoted"id' }],
            offset: 0,
            limit: 2,
            total: 3,
          })
          .mockResolvedValueOnce({
            results: [{ id: "last" }],
            offset: 2,
            limit: 2,
            total: 3,
          })
          .mockResolvedValueOnce({ results: [], offset: 3, limit: 2, total: 3 })
        context.search
          .mockResolvedValueOnce({
            hits: [],
            query: "dune",
            processingTimeMs: 0,
          })
          .mockResolvedValueOnce({
            hits: [{ id: "last", _rankingScore: 0.75 }],
            query: "dune",
            processingTimeMs: 0,
          })
        const filter = ["genre = fiction"]
        const batches = []

        for await (const batch of context.service.iterateMatches({
          index: "books",
          query: "dune",
          batchSize: 2,
          filter,
        })) {
          batches.push(batch)
        }

        expect(batches).toStrictEqual([
          [],
          [{ id: "last", _rankingScore: 0.75 }],
        ])
        expect(context.getDocuments.mock.calls).toStrictEqual([
          [{ fields: ["id"], offset: 0, limit: 2 }],
          [{ fields: ["id"], offset: 2, limit: 2 }],
          [{ fields: ["id"], offset: 3, limit: 2 }],
        ])
        expect(context.search.mock.calls).toStrictEqual([
          [
            "dune",
            {
              offset: 0,
              limit: 2,
              filter: ["genre = fiction", 'id IN ["first","quoted\\"id"]'],
              attributesToRetrieve: ["id"],
              showRankingScore: true,
              matchingStrategy: "last",
            },
          ],
          [
            "dune",
            {
              offset: 0,
              limit: 1,
              filter: ["genre = fiction", 'id IN ["last"]'],
              attributesToRetrieve: ["id"],
              showRankingScore: true,
              matchingStrategy: "last",
            },
          ],
        ])
        expect(filter).toStrictEqual(["genre = fiction"])
      })

      it("не выполняет поиск в пустом индексе", async () => {
        context.getDocuments.mockResolvedValueOnce({
          results: [],
          offset: 0,
          limit: 2,
          total: 0,
        })
        const iterator = context.service.iterateMatches({
          index: "books",
          query: "dune",
          batchSize: 2,
        })

        await expect(iterator.next()).resolves.toStrictEqual({
          done: true,
          value: undefined,
        })
        expect(context.search).not.toHaveBeenCalled()
      })

      it("не читает следующую страницу после остановки потребителя и работает без фильтров", async () => {
        context.getDocuments.mockResolvedValue({
          results: [{ id: "first" }],
          offset: 0,
          limit: 1,
          total: 10,
        })
        context.search.mockResolvedValueOnce({
          hits: [{ id: "first" }],
          query: "",
          processingTimeMs: 0,
        })

        for await (const batch of context.service.iterateMatches({
          index: "books",
          query: "",
          batchSize: 1,
        })) {
          expect(batch).toStrictEqual([{ id: "first" }])
          break
        }

        expect(context.getDocuments).toHaveBeenCalledTimes(1)
        expect(context.search).toHaveBeenCalledWith(
          "",
          expect.objectContaining({ filter: ['id IN ["first"]'] }),
        )
      })

      it.each(["documents", "search"])(
        "передаёт ошибку %s потребителю без продолжения обхода",
        async (source) => {
          const error = new Error("Batch failed")
          context.getDocuments.mockResolvedValue({
            results: [{ id: "first" }],
            offset: 0,
            limit: 1,
            total: 1,
          })
          if (source === "documents") {
            context.getDocuments.mockRejectedValueOnce(error)
          } else {
            context.search.mockRejectedValueOnce(error)
          }
          const iterator = context.service.iterateMatches({
            index: "books",
            query: "dune",
            batchSize: 1,
          })

          await expect(iterator.next()).rejects.toBe(error)
          expect(context.getDocuments).toHaveBeenCalledTimes(1)
          expect(context.search).toHaveBeenCalledTimes(
            source === "search" ? 1 : 0,
          )
        },
      )
    })

    describe("deleteMany", () => {
      it("удаляет выбранные id и ожидает завершения задачи", async () => {
        await expect(
          context.service.deleteMany("books", ["first", "second"]),
        ).resolves.toBeUndefined()

        expect(client.index).toHaveBeenCalledWith("books")
        expect(context.deleteDocuments).toHaveBeenCalledWith([
          "first",
          "second",
        ])
        expect(context.waitForTask).toHaveBeenCalledWith(task.taskUid, {
          timeout: 120_000,
        })
      })

      it("передаёт ошибку удаления без ожидания задачи", async () => {
        const error = new Error("Deletion failed")
        context.deleteDocuments.mockRejectedValueOnce(error)

        await expect(
          context.service.deleteMany("books", ["first"]),
        ).rejects.toBe(error)
        expect(context.waitForTask).not.toHaveBeenCalled()
      })

      it.each(["failed", "canceled"] as const)(
        "отклоняет задачу со статусом %s, сохраняя причину ошибки",
        async (status) => {
          const taskError = {
            message: "Task failed",
            code: "internal",
            type: "internal",
            link: "https://docs.meilisearch.com/errors",
          }
          context.waitForTask.mockResolvedValueOnce({
            ...task,
            uid: task.taskUid,
            batchUid: null,
            canceledBy: null,
            duration: null,
            startedAt: null,
            finishedAt: null,
            status,
            error: taskError,
          })

          await expect(
            context.service.deleteMany("books", ["first"]),
          ).rejects.toMatchObject({
            message: DICTIONARY.search.taskFailed,
            cause: taskError,
          })
        },
      )
    })

    describe.each(["upsert", "delete", "clear"] as const)("%s", (operation) => {
      const documents = [{ id: "book-1", title: "Dune" }]
      const execute = (isWaitForTask?: boolean) => {
        if (operation === "upsert") {
          return context.service.upsert("books", documents, isWaitForTask)
        }

        if (operation === "delete") {
          return context.service.delete("books", "book-1", isWaitForTask)
        }

        return context.service.clear("books", isWaitForTask)
      }
      const getMutation = () => {
        if (operation === "upsert") {
          return context.addDocuments
        }

        return operation === "delete"
          ? context.deleteDocument
          : context.deleteAllDocuments
      }

      it.each([undefined, false, true])(
        "отправляет операцию в нужный индекс с ожиданием %p",
        async (isWaitForTask) => {
          await expect(execute(isWaitForTask)).resolves.toBeUndefined()

          expect(client.index).toHaveBeenCalledWith("books")
          expect(getMutation()).toHaveBeenCalledTimes(1)

          if (operation === "upsert") {
            expect(context.addDocuments).toHaveBeenCalledWith(documents)
          } else if (operation === "delete") {
            expect(context.deleteDocument).toHaveBeenCalledWith("book-1")
          } else {
            expect(context.deleteAllDocuments).toHaveBeenCalledWith()
          }

          if (isWaitForTask === true) {
            expect(context.waitForTask).toHaveBeenCalledWith(task.taskUid, {
              timeout: 120_000,
            })
          } else {
            expect(context.waitForTask).not.toHaveBeenCalled()
          }
        },
      )

      it("передаёт ошибку отправки операции без ожидания задачи", async () => {
        const error = new Error("Mutation failed")
        getMutation().mockRejectedValueOnce(error)

        await expect(execute(true)).rejects.toBe(error)
        expect(context.waitForTask).not.toHaveBeenCalled()
      })

      it("передаёт ошибку ожидания задачи вызывающему коду", async () => {
        const error = new Error("Task timeout")
        context.waitForTask.mockRejectedValueOnce(error)

        await expect(execute(true)).rejects.toBe(error)
      })
    })

    it("передаёт ошибку ожидания настройки индекса и позволяет повторный вызов", async () => {
      const error = new Error("Task timeout")
      context.waitForTask.mockRejectedValueOnce(error)

      await expect(
        context.service.ensureIndex("books", options, true),
      ).rejects.toBe(error)
      await expect(
        context.service.ensureIndex("books", options, true),
      ).resolves.toBeUndefined()
      expect(context.updateSettings).toHaveBeenCalledTimes(2)
    })
  })
}
