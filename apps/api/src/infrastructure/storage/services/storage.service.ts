import { Readable } from "node:stream"

import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3ServiceException,
} from "@aws-sdk/client-s3"
import type { S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"
import { LoggerService } from "@infrastructure/logger/services/logger.service"
import { isNil } from "@shared/functions/checks/isNil"
import { isString } from "@shared/functions/checks/isString"

import { DEFAULT_PRESIGNED_URL_EXPIRY_SECONDS } from "../static/DEFAULT_PRESIGNED_URL_EXPIRY_SECONDS"
import { STORAGE_CLIENT } from "../static/STORAGE_CLIENT"
import type { IStorageUploadResult } from "../types/IStorageUploadResult"
import { DICTIONARY } from "@shared/static/DICTIONARY"

@Injectable()
class StorageService implements OnModuleInit {
  constructor(
    @Inject(STORAGE_CLIENT) private readonly storageClient: S3Client,
    private readonly configurationService: InfrastructureConfigService,
    private readonly loggerService: LoggerService,
  ) {}

  async onModuleInit() {
    const bucket = this.configurationService.app.name

    try {
      try {
        await this.storageClient.send(new HeadBucketCommand({ Bucket: bucket }))
        return
      } catch (error) {
        if (!this.isObjectNotFound(error)) {
          throw this.createStorageError(
            DICTIONARY.storage.operations.initializeBucket,
            bucket,
            "HeadBucket",
            error,
          )
        }

        this.logStorageError("HeadBucket", bucket, error)

        const isBucketCreationEnabled =
          this.configurationService.app.environment !== "production"

        if (!isBucketCreationEnabled) {
          throw new ServiceUnavailableException(
            DICTIONARY.storage.bucketMissing(bucket),
            { cause: error },
          )
        }
      }

      try {
        await this.storageClient.send(
          new CreateBucketCommand({ Bucket: bucket }),
        )
      } catch (error) {
        throw this.createStorageError(
          DICTIONARY.storage.operations.initializeBucket,
          bucket,
          "CreateBucket",
          error,
        )
      }
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error
      }

      throw this.createStorageError(
        DICTIONARY.storage.operations.initializeBucket,
        bucket,
        "unknown",
        error,
      )
    }
  }

  async upload(path: string, body: Buffer | Readable, contentType: string) {
    try {
      await this.storageClient.send(
        new PutObjectCommand({
          Bucket: this.getBucket(),
          Key: path,
          Body: body,
          ContentType: contentType,
        }),
      )
      const object = await this.storageClient.send(
        new HeadObjectCommand({
          Bucket: this.getBucket(),
          Key: path,
        }),
      )
      const publicUrl = this.createPublicUrl(path)

      if (isNil(object.ContentLength)) {
        throw new Error(DICTIONARY.storage.objectSizeUnavailable)
      }

      const processedUpload: IStorageUploadResult = {
        path,
        size: object.ContentLength,
        mimeType: contentType,
      }

      if (publicUrl !== undefined) {
        processedUpload.publicUrl = publicUrl
      }

      return processedUpload
    } catch (error) {
      throw this.createStorageError(
        DICTIONARY.storage.operations.upload,
        path,
        "PutObject/HeadObject",
        error,
      )
    }
  }

  async download(path: string) {
    try {
      const object = await this.storageClient.send(
        new GetObjectCommand({
          Bucket: this.getBucket(),
          Key: path,
        }),
      )

      if (!(object.Body instanceof Readable)) {
        throw new Error(DICTIONARY.storage.objectBodyUnavailable)
      }

      return object.Body
    } catch (error) {
      throw this.createStorageError(
        DICTIONARY.storage.operations.download,
        path,
        "GetObject",
        error,
      )
    }
  }

  async delete(path: string) {
    try {
      await this.storageClient.send(
        new DeleteObjectCommand({
          Bucket: this.getBucket(),
          Key: path,
        }),
      )
    } catch (error) {
      throw this.createStorageError(
        DICTIONARY.storage.operations.delete,
        path,
        "DeleteObject",
        error,
      )
    }
  }

  async deleteMany(paths: string[]) {
    await Promise.all(paths.map((path) => this.delete(path)))
  }

  async isExists(path: string) {
    try {
      await this.storageClient.send(
        new HeadObjectCommand({
          Bucket: this.getBucket(),
          Key: path,
        }),
      )

      return true
    } catch (error) {
      if (this.isObjectNotFound(error)) {
        return false
      }

      throw this.createStorageError(
        DICTIONARY.storage.operations.checkExistence,
        path,
        "HeadObject",
        error,
      )
    }
  }

  async presignedReadUrl(path: string, expiresSeconds?: number) {
    try {
      return await getSignedUrl(
        this.storageClient,
        new GetObjectCommand({
          Bucket: this.getBucket(),
          Key: path,
        }),
        {
          expiresIn: expiresSeconds ?? DEFAULT_PRESIGNED_URL_EXPIRY_SECONDS,
        },
      )
    } catch (error) {
      throw this.createStorageError(
        DICTIONARY.storage.operations.createReadUrl,
        path,
        "GetObject presign",
        error,
      )
    }
  }

  async presignedWriteUrl(path: string, expiresSeconds?: number) {
    try {
      return await getSignedUrl(
        this.storageClient,
        new PutObjectCommand({
          Bucket: this.getBucket(),
          Key: path,
        }),
        {
          expiresIn: expiresSeconds ?? DEFAULT_PRESIGNED_URL_EXPIRY_SECONDS,
        },
      )
    } catch (error) {
      throw this.createStorageError(
        DICTIONARY.storage.operations.createWriteUrl,
        path,
        "PutObject presign",
        error,
      )
    }
  }

  private getBucket() {
    return this.configurationService.app.name
  }

  private createPublicUrl(path: string) {
    const publicUrl = this.configurationService.storage.publicUrl

    if (isNil(publicUrl) || publicUrl === "") {
      return undefined
    }

    const encodedPath = path
      .split("/")
      .map((pathSegment) => {
        return encodeURIComponent(pathSegment)
      })
      .join("/")

    return `${publicUrl.replace(/\/$/, "")}/${encodedPath}`
  }

  private isObjectNotFound(error: unknown) {
    if (!(error instanceof S3ServiceException)) {
      return false
    }

    return (
      error.name === "NotFound" ||
      error.name === "NoSuchBucket" ||
      error.name === "NoSuchKey" ||
      error.$metadata?.httpStatusCode === 404
    )
  }

  private createStorageError(
    operation: string,
    path: string,
    command: string,
    cause: unknown,
  ) {
    this.logStorageError(command, path, cause)

    return new ServiceUnavailableException(
      DICTIONARY.storage.operationFailed(operation, path),
      { cause },
    )
  }

  private logStorageError(command: string, path: string, error: unknown) {
    const errorName = error instanceof Error ? error.name : undefined
    const errorMessage = error instanceof Error ? error.message : undefined
    const errorCode = this.getStorageErrorCode(error)
    const metadata =
      error instanceof S3ServiceException ? error.$metadata : undefined

    this.loggerService.error(DICTIONARY.storage.commandFailed(command), error, {
      context: StorageService.name,
      data: {
        command,
        path,
        errorName,
        errorMessage,
        errorCode,
        metadata,
        httpStatusCode: metadata?.httpStatusCode,
        requestId: metadata?.requestId,
      },
    })
  }

  private getStorageErrorCode(error: unknown) {
    if (error instanceof S3ServiceException) {
      return error.name
    }

    if (typeof error !== "object" || isNil(error)) {
      return undefined
    }

    const code = Reflect.get(error, "code") ?? Reflect.get(error, "Code")

    return isString(code) ? code : undefined
  }
}

export { StorageService }
