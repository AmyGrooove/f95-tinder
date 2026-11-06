import { describe, expect, it } from "@jest/globals"
import type { ExecutionContext } from "@nestjs/common"
import { ROUTE_ARGS_METADATA } from "@nestjs/common/constants"
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host"

import { UploadedImage } from "../core/UploadedImage"

const resolveUpload = (field: string | undefined, request: object) => {
  class Controller {
    upload() {}
  }

  UploadedImage(field)(Controller.prototype, "upload", 0)
  const metadata = Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    Controller,
    "upload",
  ) as Record<
    string,
    {
      data: string | undefined
      factory: (data: string | undefined, context: ExecutionContext) => unknown
    }
  >
  const [parameter] = Object.values(metadata)

  return parameter.factory(parameter.data, new ExecutionContextHost([request]))
}

describe("UploadedImage", () => {
  it.each([undefined, ""])(
    "возвращает все загрузки, когда поле %j не задано",
    (field) => {
      const processedUploads = { cover: { key: "cover.webp" } }

      expect(resolveUpload(field, { processedUploads })).toBe(processedUploads)
    },
  )

  it("возвращает загрузку для указанного поля", () => {
    const cover = { key: "cover.webp" }

    expect(resolveUpload("cover", { processedUploads: { cover } })).toBe(cover)
  })

  it("возвращает undefined, если запрошенной загрузки нет", () => {
    expect(resolveUpload("cover", {})).toBeUndefined()
    expect(resolveUpload("cover", { processedUploads: {} })).toBeUndefined()
  })
})
