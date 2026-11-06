import { describe, expect, it } from "@jest/globals"
import { INTERCEPTORS_METADATA } from "@nestjs/common/constants"
import { Reflector } from "@nestjs/core"

import { ImageUploadInterceptor } from "@infrastructure/storage/services/imageUploadInterceptor"
import { IMAGE_UPLOAD_METADATA_KEY } from "../../../static/IMAGE_UPLOAD_METADATA_KEY"
import { ImageUpload } from "../core/ImageUpload"

describe("ImageUpload", () => {
  it("подключает перехватчик и передаёт ему поле и настройки загрузки", () => {
    const options = { path: "covers", maxBytes: 1024 }

    class Controller {
      @ImageUpload("cover", options)
      upload() {}
    }

    const reflector = new Reflector()
    const handler = Controller.prototype.upload
    expect(reflector.get(IMAGE_UPLOAD_METADATA_KEY, handler)).toEqual({
      field: "cover",
      options,
    })
    expect(reflector.get(INTERCEPTORS_METADATA, handler)).toEqual([
      ImageUploadInterceptor,
    ])
  })
})
