import type { Readable } from "node:stream"

import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common"
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common"
import type { Client } from "minio"

import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"
import { isFunction } from "@shared/functions/checks/isFunction"
import { isNil } from "@shared/functions/checks/isNil"

import { STORAGE_CLIENT } from "../static/STORAGE_CLIENT"
import type { IStorageUploadResult } from "../types/IStorageUploadResult"

@Injectable()
class StorageService implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject(STORAGE_CLIENT) private readonly storageClient: Client,
    private readonly configurationService: InfrastructureConfigService,
  ) {}

  async onModuleInit() {
    const bucket = this.configurationService.app.name

    try {
      const isBucketExists = await this.storageClient.bucketExists(bucket)

      if (isBucketExists) {
        return
      }

      const isBucketCreationEnabled =
        this.configurationService.app.environment !== "production"

      if (!isBucketCreationEnabled) {
        throw new ServiceUnavailableException(
          `Storage bucket '${bucket}' does not exist and auto-creation is disabled`,
        )
      }

      await this.storageClient.makeBucket(bucket)
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error
      }

      throw this.createStorageError("initialize bucket", bucket)
    }
  }

  async onModuleDestroy() {
    const clientWithClose = this.storageClient as Client & {
      close?: () => Promise<void> | void
    }

    if (isFunction(clientWithClose.close)) {
      await clientWithClose.close()
    }
  }

  async upload(path: string, body: Buffer | Readable, contentType: string) {
    try {
      await this.storageClient.putObject(
        this.getBucket(),
        path,
        body,
        undefined,
        { "Content-Type": contentType },
      )
      const object = await this.storageClient.statObject(this.getBucket(), path)
      const publicUrl = this.createPublicUrl(path)

      const processedUpload: IStorageUploadResult = {
        path,
        size: object.size,
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
      return await this.storageClient.getObject(this.getBucket(), path)
    } catch {
      throw this.createStorageError("download", path)
    }
  }

  async delete(path: string) {
    try {
      await this.storageClient.removeObject(this.getBucket(), path)
    } catch {
      throw this.createStorageError("delete", path)
    }
  }

  async deleteMany(paths: string[]) {
    await Promise.all(paths.map((path) => this.delete(path)))
  }

  async isExists(path: string) {
    try {
      await this.storageClient.statObject(this.getBucket(), path)

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
      return await this.storageClient.presignedGetObject(
        this.getBucket(),
        path,
        expiresSeconds,
      )
    } catch {
      throw this.createStorageError("create read URL", path)
    }
  }

  async presignedWriteUrl(path: string, expiresSeconds?: number) {
    try {
      return await this.storageClient.presignedPutObject(
        this.getBucket(),
        path,
        expiresSeconds,
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
    if (!(error instanceof Error)) {
      return false
    }

    return "code" in error && error.code === "NoSuchKey"
  }

  private createStorageError(operation: string, path: string) {
    return new ServiceUnavailableException(
      `Storage ${operation} failed for '${path}'`,
    )
  }
}

export { StorageService }
