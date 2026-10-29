import { Readable } from "node:stream"

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3"
import { ServiceUnavailableException } from "@nestjs/common"

import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"
import { LoggerService } from "@infrastructure/logger/services/logger.service"
import { DICTIONARY } from "@shared/static/DICTIONARY"
import { createTestConfiguration } from "@test/functions/createTestConfiguration"

import { StorageService } from "../services/storage.service"

describe("StorageService", () => {
  const send = jest.fn<(command: unknown) => Promise<Record<string, unknown>>>()
  const configuration = createTestConfiguration(
    "mongodb://127.0.0.1:1/test",
    "redis://127.0.0.1:1",
  )
  const config = new InfrastructureConfigService(configuration)
  const logger = new LoggerService(config)
  let client: S3Client
  let service: StorageService

  beforeEach(() => {
    configuration.app.environment = "development"
    configuration.storage.publicUrl = "https://cdn.example.test/base/"
    send.mockReset().mockResolvedValue({})
    client = new S3Client({
      endpoint: "https://storage.example.test",
      region: "us-east-1",
      forcePathStyle: true,
      credentials: { accessKeyId: "test-key", secretAccessKey: "test-secret" },
    })
    jest
      .spyOn(
        client as {
          send: (command: unknown) => Promise<Record<string, unknown>>
        },
        "send",
      )
      .mockImplementation(send)
    jest.spyOn(logger, "error").mockImplementation(() => undefined)
    service = new StorageService(client, config, logger)
  })

  afterEach(() => {
    client.destroy()
  })

  it("не создаёт уже существующий бакет", async () => {
    await service.onModuleInit()

    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(HeadBucketCommand)
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      input: { Bucket: "bisky-test" },
    })
    expect(logger.error).not.toHaveBeenCalled()
  })

  it("создаёт отсутствующий бакет вне production", async () => {
    send.mockRejectedValueOnce(
      new S3ServiceException({
        name: "NoSuchBucket",
        $fault: "client",
        $metadata: { httpStatusCode: 404 },
      }),
    )

    await service.onModuleInit()

    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls[1]?.[0]).toBeInstanceOf(CreateBucketCommand)
    expect(send.mock.calls[1]?.[0]).toMatchObject({
      input: { Bucket: "bisky-test" },
    })
  })

  it("отказывает при отсутствующем бакете в production без попытки создания", async () => {
    configuration.app.environment = "production"
    const error = new S3ServiceException({
      name: "NotFound",
      $fault: "client",
      $metadata: { httpStatusCode: 404 },
    })
    send.mockRejectedValueOnce(error)

    await expect(service.onModuleInit()).rejects.toMatchObject({
      message: DICTIONARY.storage.bucketMissing("bisky-test"),
      cause: error,
    })
    expect(send).toHaveBeenCalledTimes(1)
  })

  it("не принимает запрет доступа за отсутствие бакета и сохраняет диагностические данные", async () => {
    const error = new S3ServiceException({
      name: "AccessDenied",
      message: "Forbidden",
      $fault: "client",
      $metadata: { httpStatusCode: 403, requestId: "request-id" },
    })
    send.mockRejectedValueOnce(error)

    await expect(service.onModuleInit()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    )
    expect(send).toHaveBeenCalledTimes(1)
    expect(logger.error).toHaveBeenCalledWith(
      DICTIONARY.storage.commandFailed("HeadBucket"),
      error,
      expect.objectContaining({
        data: expect.objectContaining({
          command: "HeadBucket",
          path: "bisky-test",
          errorCode: "AccessDenied",
          httpStatusCode: 403,
          requestId: "request-id",
        }),
      }),
    )
  })

  it("передаёт ошибку создания бакета как недоступность хранилища", async () => {
    send.mockRejectedValueOnce(
      new S3ServiceException({
        name: "NotFound",
        $fault: "client",
        $metadata: {},
      }),
    )
    const error = new Error("Create failed")
    send.mockRejectedValueOnce(error)

    await expect(service.onModuleInit()).rejects.toMatchObject({
      message: DICTIONARY.storage.operationFailed(
        DICTIONARY.storage.operations.initializeBucket,
        "bisky-test",
      ),
      cause: error,
    })
  })

  it("загружает исходное тело и получает размер из метаданных, кодируя сегменты публичного URL", async () => {
    const body = Buffer.from("image")
    const path = "folder/a b#%.webp"
    send.mockResolvedValueOnce({}).mockResolvedValueOnce({ ContentLength: 17 })

    await expect(service.upload(path, body, "image/webp")).resolves.toEqual({
      path,
      size: 17,
      mimeType: "image/webp",
      publicUrl: "https://cdn.example.test/base/folder/a%20b%23%25.webp",
    })
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(PutObjectCommand)
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      input: {
        Bucket: "bisky-test",
        Key: path,
        Body: body,
        ContentType: "image/webp",
      },
    })
    expect(send.mock.calls[1]?.[0]).toBeInstanceOf(HeadObjectCommand)
    expect(send.mock.calls[1]?.[0]).toMatchObject({
      input: { Bucket: "bisky-test", Key: path },
    })
    expect(send).toHaveBeenCalledTimes(2)
  })

  it("поддерживает поток и нулевой размер без публичного URL", async () => {
    configuration.storage.publicUrl = ""
    const body = Readable.from([])
    send.mockResolvedValueOnce({}).mockResolvedValueOnce({ ContentLength: 0 })

    await expect(
      service.upload("empty", body, "application/octet-stream"),
    ).resolves.toEqual({
      path: "empty",
      size: 0,
      mimeType: "application/octet-stream",
    })
    expect(send.mock.calls[0]?.[0]).toMatchObject({ input: { Body: body } })
  })

  it("не возвращает успешную загрузку при отсутствующем размере", async () => {
    await expect(
      service.upload("file", Buffer.alloc(0), "text/plain"),
    ).rejects.toMatchObject({
      cause: new Error(DICTIONARY.storage.objectSizeUnavailable),
    })
  })

  it("не читает метаданные после сбоя загрузки", async () => {
    const error = new Error("Upload failed")
    send.mockRejectedValueOnce(error)

    await expect(
      service.upload("file", Buffer.from("body"), "text/plain"),
    ).rejects.toMatchObject({ cause: error })
    expect(send).toHaveBeenCalledTimes(1)
  })

  it("возвращает исходный поток скачивания без чтения в память", async () => {
    const body = Readable.from(["body"])
    send.mockResolvedValueOnce({ Body: body })

    await expect(service.download("folder/file")).resolves.toBe(body)
    expect(body.readableDidRead).toBe(false)
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(GetObjectCommand)
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      input: { Bucket: "bisky-test", Key: "folder/file" },
    })
  })

  it("отклоняет скачивание без Node-потока", async () => {
    send.mockResolvedValueOnce({ Body: Buffer.from("body") })

    await expect(service.download("file")).rejects.toMatchObject({
      cause: new Error(DICTIONARY.storage.objectBodyUnavailable),
    })
  })

  it("удаляет каждый запрошенный объект и поддерживает пустой список", async () => {
    await service.deleteMany([])
    expect(send).not.toHaveBeenCalled()
    await service.deleteMany(["first", "second"])

    expect(send).toHaveBeenCalledTimes(2)
    for (const [index, path] of ["first", "second"].entries()) {
      expect(send.mock.calls[index]?.[0]).toBeInstanceOf(DeleteObjectCommand)
      expect(send.mock.calls[index]?.[0]).toMatchObject({
        input: { Bucket: "bisky-test", Key: path },
      })
    }
  })

  it("не скрывает частичный сбой удаления списка", async () => {
    const error = new Error("Delete failed")
    send.mockRejectedValueOnce(error)

    await expect(service.deleteMany(["first", "second"])).rejects.toMatchObject(
      { cause: error },
    )
    expect(send).toHaveBeenCalledTimes(2)
  })

  it("возвращает true при доступном объекте", async () => {
    await expect(service.isExists("file")).resolves.toBe(true)
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(HeadObjectCommand)
  })

  it.each([
    { name: "NotFound", status: 400 },
    { name: "NoSuchBucket", status: 400 },
    { name: "NoSuchKey", status: 400 },
    { name: "Unknown", status: 404 },
  ])(
    "возвращает false для распознанного отсутствия объекта $name/$status",
    async ({ name, status }) => {
      send.mockRejectedValueOnce(
        new S3ServiceException({
          name,
          $fault: "client",
          $metadata: { httpStatusCode: status },
        }),
      )

      await expect(service.isExists("file")).resolves.toBe(false)
    },
  )

  it.each([
    new S3ServiceException({
      name: "AccessDenied",
      $fault: "client",
      $metadata: { httpStatusCode: 403 },
    }),
    {
      name: "NotFound",
      code: "ECONNRESET",
      $metadata: { httpStatusCode: 404 },
    },
  ])(
    "не маскирует запрет доступа и ошибки другого типа под отсутствие объекта: %p",
    async (error) => {
      send.mockRejectedValueOnce(error)

      await expect(service.isExists("file")).rejects.toMatchObject({
        cause: error,
      })
      expect(logger.error).toHaveBeenCalled()
    },
  )

  it.each([
    { operation: "presignedReadUrl", seconds: undefined, expected: "604800" },
    { operation: "presignedReadUrl", seconds: 60, expected: "60" },
    { operation: "presignedWriteUrl", seconds: undefined, expected: "604800" },
    { operation: "presignedWriteUrl", seconds: 60, expected: "60" },
  ] as const)(
    "подписывает $operation на $expected секунд без сетевого запроса",
    async ({ operation, seconds, expected }) => {
      client.middlewareStack.add(
        (next) => async (args) => {
          expect(args.request).toMatchObject({
            method: operation === "presignedReadUrl" ? "GET" : "PUT",
          })

          return await next(args)
        },
        { step: "build", name: "assertSignedMethod" },
      )
      const url = new URL(await service[operation]("folder/file.txt", seconds))

      expect(url.origin).toBe("https://storage.example.test")
      expect(url.pathname).toBe("/bisky-test/folder/file.txt")
      expect(url.searchParams.get("X-Amz-Expires")).toBe(expected)
      expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[a-f0-9]{64}$/)
      expect(send).not.toHaveBeenCalled()
    },
  )

  it("оборачивает ошибку подписи с сохранением причины", async () => {
    const error = new Error("Credentials unavailable")
    jest.spyOn(client.config, "credentials").mockRejectedValue(error)

    await expect(service.presignedReadUrl("file")).rejects.toMatchObject({
      cause: error,
      message: DICTIONARY.storage.operationFailed(
        DICTIONARY.storage.operations.createReadUrl,
        "file",
      ),
    })
  })
})
