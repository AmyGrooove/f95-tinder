import { Readable } from "node:stream"
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"
import { BadRequestException, PayloadTooLargeException } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host"
import { Test, type TestingModule } from "@nestjs/testing"
import { firstValueFrom, of, throwError } from "rxjs"

import { DICTIONARY } from "@shared/static/DICTIONARY"

import { ImageUploadInterceptor } from "../interceptors/imageUpload.interceptor"
import { ImageProcessingService } from "../services/imageProcessing.service"
import { StorageService } from "../services/storage.service"
import { DEFAULT_IMAGE_QUALITY } from "../static/DEFAULT_IMAGE_QUALITY"
import { IMAGE_UPLOAD_METADATA_KEY } from "../static/IMAGE_UPLOAD_METADATA_KEY"
import type { IImageUploadOptions } from "../types/IImageUploadOptions"
import type { IStorageUploadResult } from "../types/IStorageUploadResult"

describe("ImageUploadInterceptor", () => {
  const processImage = jest.fn<ImageProcessingService["processImage"]>()
  const upload = jest.fn<StorageService["upload"]>()
  const remove = jest.fn<StorageService["delete"]>()
  const handle = jest.fn(() => of({ result: "saved" }))
  const processed = Buffer.from("processed-webp")
  const stored: IStorageUploadResult = {
    path: "avatars/generated.webp",
    size: processed.length,
    mimeType: "image/webp",
  }
  let moduleRef: TestingModule
  let interceptor: ImageUploadInterceptor

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        ImageUploadInterceptor,
        Reflector,
        { provide: ImageProcessingService, useValue: { processImage } },
        { provide: StorageService, useValue: { upload, delete: remove } },
      ],
    }).compile()
    interceptor = moduleRef.get(ImageUploadInterceptor)
  })

  beforeEach(() => {
    processImage.mockReset().mockResolvedValue(processed)
    upload.mockReset().mockResolvedValue(stored)
    remove.mockReset().mockResolvedValue(undefined)
    handle.mockReset().mockReturnValue(of({ result: "saved" }))
  })

  afterAll(async () => {
    await moduleRef?.close()
  })

  const createFile = (chunks: Buffer[], fieldname = "avatar") => {
    return {
      type: "file",
      fieldname,
      file: Readable.from(chunks),
      filename: "image.png",
      mimetype: "image/png",
    }
  }

  const createContext = (
    parts: unknown[],
    options: IImageUploadOptions = { path: "avatars///" },
  ) => {
    class TestController {}
    const handler = () => undefined
    Reflect.defineMetadata(
      IMAGE_UPLOAD_METADATA_KEY,
      { field: "avatar", options },
      handler,
    )
    const request: {
      body: Record<string, unknown>
      parts: ReturnType<typeof jest.fn<() => Readable>>
      processedUploads?: Record<string, IStorageUploadResult>
    } = {
      body: { existing: "kept" },
      parts: jest.fn(() => Readable.from(parts)),
    }

    return {
      request,
      context: new ExecutionContextHost([request], TestController, handler),
    }
  }

  it("собирает части файла, нормализует поля и передаёт метаданные контроллеру", async () => {
    const { request, context } = createContext([
      { fieldname: "title", value: { value: "Title" } },
      { fieldname: "tag", value: "first" },
      createFile([Buffer.from("first"), Buffer.from("second")]),
      { fieldname: "tag", value: "second" },
      { fieldname: "tag", value: "third" },
    ])

    await expect(
      firstValueFrom(await interceptor.intercept(context, { handle })),
    ).resolves.toStrictEqual({ result: "saved" })

    expect(processImage).toHaveBeenCalledWith(
      Buffer.from("firstsecond"),
      "image/png",
      {
        maxBytes: 5 * 1024 * 1024,
        maxHeight: 4_000,
        maxPixels: 16_000_000,
        maxWidth: 4_000,
        quality: DEFAULT_IMAGE_QUALITY,
        resizeHeight: undefined,
        resizeWidth: undefined,
      },
    )
    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(/^avatars\/[0-9a-f-]{36}\.webp$/),
      processed,
      "image/webp",
    )
    expect(request.body).toStrictEqual({
      existing: "kept",
      title: "Title",
      tag: ["first", "second", "third"],
    })
    expect(request.processedUploads).toStrictEqual({ avatar: stored })
    expect(handle).toHaveBeenCalledTimes(1)
    expect(remove).not.toHaveBeenCalled()
  })

  it("передаёт явно заданные ограничения и параметры преобразования", async () => {
    const options = {
      path: "avatars",
      maxBytes: 3,
      maxHeight: 20,
      maxWidth: 30,
      maxPixels: 600,
      quality: 60,
      resizeWidth: 10,
      resizeHeight: 10,
    }
    const { context } = createContext(
      [createFile([Buffer.from("123")])],
      options,
    )

    await firstValueFrom(await interceptor.intercept(context, { handle }))

    expect(processImage).toHaveBeenCalledWith(Buffer.from("123"), "image/png", {
      maxBytes: 3,
      maxHeight: 20,
      maxWidth: 30,
      maxPixels: 600,
      quality: 60,
      resizeWidth: 10,
      resizeHeight: 10,
    })
  })

  it("пропускает маршрут без метаданных загрузки", async () => {
    const { request, context } = createContext([])
    Reflect.deleteMetadata(IMAGE_UPLOAD_METADATA_KEY, context.getHandler())

    await firstValueFrom(await interceptor.intercept(context, { handle }))

    expect(request.parts).not.toHaveBeenCalled()
    expect(processImage).not.toHaveBeenCalled()
    expect(upload).not.toHaveBeenCalled()
  })

  it("отклоняет отсутствие обязательного файла до вызова контроллера", async () => {
    const { context } = createContext([{ fieldname: "title", value: "Title" }])

    await expect(interceptor.intercept(context, { handle })).rejects.toThrow(
      new BadRequestException(DICTIONARY.image.missingField("avatar")),
    )
    expect(processImage).not.toHaveBeenCalled()
    expect(upload).not.toHaveBeenCalled()
    expect(handle).not.toHaveBeenCalled()
  })

  it.each(["wrong-field", "second-file"])(
    "отклоняет лишний файл %s и освобождает его поток",
    async (kind) => {
      const file = createFile(
        [Buffer.from("input")],
        kind === "wrong-field" ? "other" : "avatar",
      )
      const resume = jest.spyOn(file.file, "resume")
      const { context } = createContext(
        kind === "second-file"
          ? [createFile([Buffer.from("first")]), file]
          : [file],
      )

      await expect(interceptor.intercept(context, { handle })).rejects.toThrow(
        new BadRequestException(DICTIONARY.image.exactlyOneFileRequired),
      )
      expect(resume).toHaveBeenCalled()
      expect(upload).not.toHaveBeenCalled()
      expect(handle).not.toHaveBeenCalled()
    },
  )

  it("прерывает накопление файла при превышении лимита и освобождает поток", async () => {
    const file = createFile([Buffer.from("12"), Buffer.from("34")])
    const resume = jest.spyOn(file.file, "resume")
    const { context } = createContext([file], { path: "avatars", maxBytes: 3 })

    await expect(interceptor.intercept(context, { handle })).rejects.toThrow(
      new PayloadTooLargeException(DICTIONARY.image.byteLimitExceeded),
    )
    expect(resume).toHaveBeenCalled()
    expect(processImage).not.toHaveBeenCalled()
    expect(upload).not.toHaveBeenCalled()
    expect(handle).not.toHaveBeenCalled()
  })

  it.each(["processing", "upload"])(
    "передаёт ошибку %s без вызова контроллера",
    async (source) => {
      const error = new Error("Upload failed")
      if (source === "processing") {
        processImage.mockRejectedValueOnce(error)
      } else {
        upload.mockRejectedValueOnce(error)
      }
      const { context } = createContext([createFile([Buffer.from("input")])])

      await expect(interceptor.intercept(context, { handle })).rejects.toBe(
        error,
      )
      expect(handle).not.toHaveBeenCalled()
      expect(remove).not.toHaveBeenCalled()
      expect(upload).toHaveBeenCalledTimes(source === "upload" ? 1 : 0)
    },
  )

  it.each([false, true])(
    "удаляет загруженный объект после ошибки контроллера и сохраняет её при ошибке очистки %p",
    async (isCleanupFailed) => {
      const error = new Error("Controller failed")
      handle.mockReturnValueOnce(throwError(() => error))
      if (isCleanupFailed) {
        remove.mockRejectedValueOnce(new Error("Cleanup failed"))
      }
      const { context } = createContext([createFile([Buffer.from("input")])])

      await expect(
        firstValueFrom(await interceptor.intercept(context, { handle })),
      ).rejects.toBe(error)
      expect(remove).toHaveBeenCalledTimes(1)
      expect(remove).toHaveBeenCalledWith(stored.path)
    },
  )
})
