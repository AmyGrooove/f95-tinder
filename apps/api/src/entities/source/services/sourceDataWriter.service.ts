import { Injectable } from "@nestjs/common"

import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { NonRetryableJobError } from "@infrastructure/jobs/errors/NonRetryableJobError"
import { StorageService } from "@infrastructure/storage/services/storage.service"
import { isInt } from "@shared/functions/checks/isInt"
import { isNonNegativeSafe } from "@shared/functions/checks/isNonNegativeSafe"

import type {
  ISourceDataManifestProps,
  ISourceDataPageProps,
  ISourceDataStoragePathProps,
} from "../types/ISourceDataWriterProps"

@Injectable()
class SourceDataWriterService {
  constructor(private readonly storageService: StorageService) {}

  getStoragePath({ sourceKey, scope, context }: ISourceDataStoragePathProps) {
    return `sources/${sourceKey}/${scope}/${context.id}/attempt-${context.attempt}`
  }

  writePage({ storagePath, section, pageNumber, body }: ISourceDataPageProps) {
    if (
      !isInt(pageNumber) ||
      !isNonNegativeSafe(pageNumber) ||
      pageNumber < 1
    ) {
      throw new NonRetryableJobError(DICTIONARY.source.invalidPageNumber)
    }

    const fileName = `${String(pageNumber).padStart(6, "0")}.json`

    return this.storageService.upload(
      `${storagePath}/${section}/${fileName}`,
      body,
      "application/json",
    )
  }

  writeManifest({ storagePath, manifest }: ISourceDataManifestProps) {
    return this.storageService.upload(
      `${storagePath}/manifest.json`,
      Buffer.from(JSON.stringify(manifest)),
      "application/json",
    )
  }
}

export { SourceDataWriterService }
