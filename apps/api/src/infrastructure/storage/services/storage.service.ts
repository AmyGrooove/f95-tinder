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
import { isNil } from "@shared/functions/checks/isNil"

import { DEFAULT_PRESIGNED_URL_EXPIRY_SECONDS } from "../static/DEFAULT_PRESIGNED_URL_EXPIRY_SECONDS"
import { STORAGE_CLIENT } from "../static/STORAGE_CLIENT"
import type { IStorageUploadResult } from "../types/IStorageUploadResult"

@Injectable()
class StorageService implements OnModuleInit {
  constructor(
    @Inject(STORAGE_CLIENT) private readonly storageClient: S3Client,
    private readonly configurationService: InfrastructureConfigService,
  ) {}

  async onModuleInit() {
    const bucket = this.configurationService.app.name

    try {
      try {
        await this.storageClient.send(new HeadBucketCommand({ Bucket: bucket }))
        return
      } catch (error) {
        if (!this.isObjectNotFound(error)) {
          throw error
        }
      }

      const isBucketCreationEnabled =
        this.configurationService.app.environment !== "production"

      if (!isBucketCreationEnabled) {
        throw new ServiceUnavailableException(
          `Storage bucket '${bucket}' does not exist and auto-creation is disabled`,
        )
      }

      await this.storageClient.send(new CreateBucketCommand({ Bucket: bucket }))
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error
      }

      throw this.createStorageError("initialize bucket", bucket)
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
        throw new Error("Storage object size is unavailable")
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
    } catch {
      throw this.createStorageError("upload", path)
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
        throw new Error("Storage object body is unavailable")
      }

      return object.Body
    } catch {
      throw this.createStorageError("download", path)
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
    } catch {
      throw this.createStorageError("delete", path)
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

      throw this.createStorageError("check existence", path)
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
    } catch {
      throw this.createStorageError("create read URL", path)
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
    } catch {
      throw this.createStorageError("create write URL", path)
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
      error.name === "NoSuchKey" ||
      error.$metadata.httpStatusCode === 404
    )
  }

  private createStorageError(operation: string, path: string) {
    return new ServiceUnavailableException(
      `Storage ${operation} failed for '${path}'`,
    )
  }
}

export { StorageService }
