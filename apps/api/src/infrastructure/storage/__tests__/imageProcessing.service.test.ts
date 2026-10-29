import { beforeAll, describe, expect, it } from "@jest/globals"
import { BadRequestException } from "@nestjs/common"
import sharp from "sharp"

import { DICTIONARY } from "@shared/static/DICTIONARY"

import { ImageProcessingService } from "../services/imageProcessing.service"
import type { IProcessImageOptions } from "../types/IProcessImageOptions"

describe("ImageProcessingService", () => {
  const service = new ImageProcessingService()
  const options: IProcessImageOptions = {
    maxBytes: 100_000,
    maxWidth: 20,
    maxHeight: 20,
    maxPixels: 400,
    quality: 80,
  }
  let png: Buffer

  beforeAll(async () => {
    png = await sharp({
      create: {
        width: 12,
        height: 8,
        channels: 4,
        background: { r: 210, g: 40, b: 30, alpha: 0.5 },
      },
    })
      .png()
      .toBuffer()
  })

  it.each(["png", "jpeg", "webp", "avif"] as const)(
    "преобразует настоящее изображение %s в читаемый WebP",
    async (format) => {
      const input = await sharp(png).toFormat(format).toBuffer()

      const result = await service.processImage(
        input,
        `image/${format}`,
        options,
      )

      expect(await sharp(result).metadata()).toMatchObject({
        format: "webp",
        width: 12,
        height: 8,
      })
      const { info } = await sharp(result)
        .raw()
        .toBuffer({ resolveWithObject: true })
      expect(info).toMatchObject({ width: 12, height: 8 })
    },
  )

  it("уменьшает и обрезает изображение до целевых размеров, сохраняя прозрачность", async () => {
    const result = await service.processImage(png, "image/png", {
      ...options,
      resizeWidth: 6,
      resizeHeight: 6,
    })

    expect(await sharp(result).metadata()).toMatchObject({
      width: 6,
      height: 6,
      hasAlpha: true,
    })
  })

  it("не увеличивает изображение до большего целевого размера", async () => {
    const result = await service.processImage(png, "image/png", {
      ...options,
      resizeWidth: 100,
      resizeHeight: 100,
    })

    expect(await sharp(result).metadata()).toMatchObject({
      width: 12,
      height: 8,
    })
  })

  it("учитывает EXIF-поворот и удаляет исходные метаданные", async () => {
    const input = await sharp(png)
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer()

    const result = await service.processImage(input, "image/jpeg", options)
    const metadata = await sharp(result).metadata()

    expect(metadata).toMatchObject({ width: 8, height: 12, format: "webp" })
    expect(metadata.orientation).toBeUndefined()
    expect(metadata.exif).toBeUndefined()
  })

  it("принимает изображение точно на границах байтов, размеров и числа пикселей", async () => {
    const result = await service.processImage(png, "image/png", {
      ...options,
      maxBytes: png.length,
      maxWidth: 12,
      maxHeight: 8,
      maxPixels: 96,
    })

    expect(await sharp(result).metadata()).toMatchObject({
      width: 12,
      height: 8,
    })
  })

  it("отклоняет пустой файл", async () => {
    await expect(
      service.processImage(Buffer.alloc(0), "image/png", options),
    ).rejects.toThrow(new BadRequestException(DICTIONARY.image.emptyUpload))
  })

  it("отклоняет неподдерживаемый заявленный тип", async () => {
    await expect(
      service.processImage(png, "image/gif", options),
    ).rejects.toThrow(
      new BadRequestException(DICTIONARY.image.unsupportedMimeType),
    )
  })

  it("отклоняет файл, превышающий лимит на один байт", async () => {
    await expect(
      service.processImage(png, "image/png", {
        ...options,
        maxBytes: png.length - 1,
      }),
    ).rejects.toThrow(
      new BadRequestException(DICTIONARY.image.byteLimitExceeded),
    )
  })

  it("отклоняет расхождение заявленного и декодированного MIME", async () => {
    await expect(
      service.processImage(png, "image/jpeg", options),
    ).rejects.toThrow(
      new BadRequestException(DICTIONARY.image.mimeTypeMismatch),
    )
  })

  it("отклоняет декодируемый SVG под видом PNG", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="8"/>',
    )

    await expect(
      service.processImage(svg, "image/png", options),
    ).rejects.toThrow(
      new BadRequestException(DICTIONARY.image.unsupportedDecodedMimeType),
    )
  })

  it.each([{ maxWidth: 11 }, { maxHeight: 7 }])(
    "проверяет исходные размеры %p до уменьшения изображения",
    async (limits) => {
      await expect(
        service.processImage(png, "image/png", {
          ...options,
          ...limits,
          resizeWidth: 1,
          resizeHeight: 1,
        }),
      ).rejects.toThrow(
        new BadRequestException(DICTIONARY.image.dimensionLimitExceeded),
      )
    },
  )

  it.each(["invalid-content", "pixel-limit"])(
    "возвращает 400 и сохраняет причину ошибки декодирования: %s",
    async (failure) => {
      await expect(
        service.processImage(
          failure === "invalid-content" ? Buffer.from("not an image") : png,
          "image/png",
          {
            ...options,
            maxPixels: failure === "pixel-limit" ? 95 : options.maxPixels,
          },
        ),
      ).rejects.toMatchObject({
        message: DICTIONARY.image.processingFailed,
        cause: expect.any(Error),
      })
    },
  )
})
