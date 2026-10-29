import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { ErrorStatusCode, Meilisearch, MeilisearchApiError } from "meilisearch"
import type { EnqueuedTask } from "meilisearch"

import { DICTIONARY } from "@shared/static/DICTIONARY"

import { SearchService } from "../services/search.service"

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

      await expect(context.service.ensureIndex("books", options)).rejects.toBe(
        error,
      )
      expect(context.updateSettings).not.toHaveBeenCalled()
    })

    it("позволяет повторить инициализацию после ошибки применения настроек", async () => {
      const error = new Error("Settings failed")
      context.updateSettings.mockRejectedValueOnce(error)

      await expect(context.service.ensureIndex("books", options)).rejects.toBe(
        error,
      )
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

      await expect(context.service.search("books", "dune")).rejects.toBe(error)
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
        .mockResolvedValueOnce({ hits: [], query: "dune", processingTimeMs: 0 })
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

      expect(batches).toStrictEqual([[], [{ id: "last", _rankingScore: 0.75 }]])
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
      expect(context.deleteDocuments).toHaveBeenCalledWith(["first", "second"])
      expect(context.waitForTask).toHaveBeenCalledWith(task.taskUid, {
        timeout: 120_000,
      })
    })

    it("передаёт ошибку удаления без ожидания задачи", async () => {
      const error = new Error("Deletion failed")
      context.deleteDocuments.mockRejectedValueOnce(error)

      await expect(context.service.deleteMany("books", ["first"])).rejects.toBe(
        error,
      )
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
