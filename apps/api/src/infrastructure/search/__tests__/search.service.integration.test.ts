import { execFile } from "node:child_process"
import { randomUUID } from "node:crypto"
import { setTimeout } from "node:timers/promises"
import { promisify } from "node:util"
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@jest/globals"
import { Test } from "@nestjs/testing"
import type { TestingModule } from "@nestjs/testing"
import { ErrorStatusCode, Meilisearch } from "meilisearch"

import { infrastructureConfiguration } from "@infrastructure/config/config.module"

import { SearchModule } from "../search.module"
import { SearchService } from "../services/search.service"
import { SEARCH_CLIENT } from "../static/SEARCH_CLIENT"

describe("SearchService Meilisearch", () => {
  const docker = promisify(execFile)
  const containerName = `bisky-search-test-${randomUUID()}`
  const apiKey = randomUUID()
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
  let containerId: string | undefined
  let moduleRef: TestingModule | undefined
  let client: Meilisearch
  let service: SearchService
  let indexName: string

  beforeAll(async () => {
    const { stdout } = await docker(
      "docker",
      [
        "run",
        "--detach",
        "--rm",
        "--name",
        containerName,
        "--publish",
        "127.0.0.1::7700",
        "--env",
        `MEILI_MASTER_KEY=${apiKey}`,
        "--env",
        "MEILI_NO_ANALYTICS=true",
        "getmeili/meilisearch:v1.12.8",
      ],
      { timeout: 180_000 },
    )
    containerId = stdout.trim()
    const { stdout: port } = await docker("docker", [
      "port",
      containerId,
      "7700/tcp",
    ])
    const host = `http://${port.trim()}`
    client = new Meilisearch({ host, apiKey, timeout: 1_000 })
    const deadline = Date.now() + 30_000

    while (true) {
      try {
        await client.health()
        break
      } catch (error) {
        if (Date.now() >= deadline) {
          throw error
        }

        await setTimeout(100)
      }
    }

    moduleRef = await Test.createTestingModule({ imports: [SearchModule] })
      .overrideProvider(infrastructureConfiguration.KEY)
      .useValue({ search: { host, apiKey } })
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
      if (containerId !== undefined) {
        await docker("docker", ["rm", "--force", containerId], {
          timeout: 30_000,
        })
      }
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
