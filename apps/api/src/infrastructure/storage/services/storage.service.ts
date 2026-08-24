import type { Readable } from "node:stream"

import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common"
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common"
import type { Client } from "minio"

import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"

import { STORAGE_CLIENT } from "../static/STORAGE_CLIENT"
import type { TProcessedUpload } from "../types/TProcessedUpload"

@Injectable()
class StorageService implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject(STORAGE_CLIENT) private readonly storageClient: Client,
    private readonly configurationService: InfrastructureConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const bucket = this.configurationService.app.name

    try {
      const bucketExists = await this.storageClient.bucketExists(bucket)

      if (bucketExists) {
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

  async onModuleDestroy(): Promise<void> {
    const clientWithClose = this.storageClient as Client & {
      close?: () => Promise<void> | void
    }

    if (clientWithClose.close) {
      await clientWithClose.close()
    }
  }

  async upload(
    path: string,
    body: Buffer | Readable,
    contentType: string,
  ): Promise<TProcessedUpload> {
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

      const processedUpload: TProcessedUpload = {
        path,
        size: object.size,
        mimeType: "image/webp",
      }

      if (publicUrl) {
        processedUpload.publicUrl = publicUrl
      }

      return processedUpload
    } catch {
      throw this.createStorageError("upload", path)
    }
  }

  async download(path: string): Promise<Readable> {
    try {
      return await this.storageClient.getObject(this.getBucket(), path)
    } catch {
      throw this.createStorageError("download", path)
    }
  }

  async delete(path: string): Promise<void> {
    try {
      await this.storageClient.removeObject(this.getBucket(), path)
    } catch {
      throw this.createStorageError("delete", path)
    }
  }

  async exists(path: string): Promise<boolean> {
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

  async presignedReadUrl(path: string, expiresSeconds?: number): Promise<string> {
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

  async presignedWriteUrl(path: string, expiresSeconds?: number): Promise<string> {
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

  async healthCheck(): Promise<boolean> {
    try {
      return await this.storageClient.bucketExists(this.getBucket())
    } catch {
      return false
    }
  }

  private getBucket(): string {
    return this.configurationService.app.name
  }

  private createPublicUrl(path: string): string | undefined {
    const publicUrl = this.configurationService.storage.publicUrl

    if (!publicUrl) {
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

  private isObjectNotFound(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false
    }

    return "code" in error && error.code === "NoSuchKey"
  }

  private createStorageError(
    operation: string,
    path: string,
  ): ServiceUnavailableException {
    return new ServiceUnavailableException(
      `Storage ${operation} failed for '${path}'`,
    )
  }
}

export { StorageService }
