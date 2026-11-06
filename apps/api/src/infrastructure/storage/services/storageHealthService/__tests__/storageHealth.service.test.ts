import { HeadBucketCommand, type S3Client } from "@aws-sdk/client-s3"
import { describe, expect, it, jest } from "@jest/globals"

import type { InfrastructureConfigService } from "@infrastructure/config/services/configService"
import { StorageHealthService } from "../core/storageHealth.service"

describe("StorageHealthService", () => {
  it("проверяет доступность бакета с именем приложения", async () => {
    const send = jest
      .fn<(command: HeadBucketCommand) => Promise<object>>()
      .mockResolvedValue({})
    const configuration = {
      app: { name: "bisky-test" },
    } as InfrastructureConfigService
    const service = new StorageHealthService(
      { send } as unknown as S3Client,
      configuration,
    )

    await expect(service.healthCheck()).resolves.toBe(true)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0]).toBeInstanceOf(HeadBucketCommand)
    expect(send.mock.calls[0][0].input).toEqual({ Bucket: "bisky-test" })
  })

  it("возвращает false при недоступном бакете", async () => {
    const send = jest
      .fn<() => Promise<unknown>>()
      .mockRejectedValue(new Error("offline"))
    const configuration = {
      app: { name: "bisky-test" },
    } as InfrastructureConfigService
    const service = new StorageHealthService(
      { send } as unknown as S3Client,
      configuration,
    )

    await expect(service.healthCheck()).resolves.toBe(false)
  })
})
