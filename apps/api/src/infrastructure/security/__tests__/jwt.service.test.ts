import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"
import { UnauthorizedException } from "@nestjs/common"
import {
  JwtService,
  type JwtSignOptions,
  type JwtVerifyOptions,
} from "@nestjs/jwt"
import { Test, type TestingModule } from "@nestjs/testing"

import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"
import { DICTIONARY } from "@shared/static/DICTIONARY"

import { SecurityJwtService } from "../services/jwt.service"
import { JWT_ACCESS_EXPIRATION } from "../static/JWT_ACCESS_EXPIRATION"
import { JWT_ALGORITHM } from "../static/JWT_ALGORITHM"
import { JWT_REFRESH_EXPIRATION } from "../static/JWT_REFRESH_EXPIRATION"

describe("SecurityJwtService", () => {
  const jwt = new JwtService()
  const configuration = {
    app: { name: "security-test" },
    jwt: {
      accessSecret: "test-access-secret",
      refreshSecret: "test-refresh-secret",
    },
  }
  let moduleRef: TestingModule
  let service: SecurityJwtService

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        SecurityJwtService,
        { provide: JwtService, useValue: jwt },
        { provide: InfrastructureConfigService, useValue: configuration },
      ],
    }).compile()
    service = moduleRef.get(SecurityJwtService)
  })

  beforeEach(() => {
    jest.spyOn(Date, "now").mockReturnValue(Date.UTC(2026, 0, 1))
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  afterAll(async () => {
    await moduleRef?.close()
  })

  it("подписывает access-токен с ролью, назначением и сроком жизни", async () => {
    const token = await service.signAccessToken({
      sub: "user-id",
      sessionId: "session-id",
      role: "user",
    })
    const payload = await jwt.verifyAsync(token, {
      secret: configuration.jwt.accessSecret,
      algorithms: [JWT_ALGORITHM],
      issuer: configuration.app.name,
      audience: `${configuration.app.name}-api`,
    })

    expect(payload).toStrictEqual({
      sub: "user-id",
      sessionId: "session-id",
      role: "user",
      type: "access",
      iss: configuration.app.name,
      aud: `${configuration.app.name}-api`,
      iat: Date.now() / 1000,
      exp: Date.now() / 1000 + JWT_ACCESS_EXPIRATION,
    })
    await expect(service.verifyAccessToken(token)).resolves.toStrictEqual(
      payload,
    )
  })

  it("подписывает refresh-токен без роли и создаёт уникальный UUID даже в одну секунду", async () => {
    const input = { sub: "user-id", sessionId: "session-id" }
    const first = await service.signRefreshToken(input)
    const second = await service.signRefreshToken(input)
    const options: JwtVerifyOptions = {
      secret: configuration.jwt.refreshSecret,
      algorithms: [JWT_ALGORITHM],
      issuer: configuration.app.name,
      audience: `${configuration.app.name}-api`,
    }
    const firstPayload = await jwt.verifyAsync(first, options)
    const secondPayload = await jwt.verifyAsync(second, options)

    expect(firstPayload).toStrictEqual({
      ...input,
      type: "refresh",
      jti: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      ),
      iss: configuration.app.name,
      aud: `${configuration.app.name}-api`,
      iat: Date.now() / 1000,
      exp: Date.now() / 1000 + JWT_REFRESH_EXPIRATION,
    })
    expect(secondPayload.iat).toBe(firstPayload.iat)
    expect(secondPayload.jti).not.toBe(firstPayload.jti)
    expect(second).not.toBe(first)
    await expect(service.verifyRefreshToken(first)).resolves.toStrictEqual(
      firstPayload,
    )
  })

  describe.each(["access", "refresh"] as const)("%s", (type) => {
    const payload = {
      sub: "user-id",
      sessionId: "session-id",
      type,
      ...(type === "access" ? { role: "user" } : {}),
    }
    const options: JwtSignOptions = {
      secret:
        type === "access"
          ? configuration.jwt.accessSecret
          : configuration.jwt.refreshSecret,
      algorithm: JWT_ALGORITHM,
      issuer: configuration.app.name,
      audience: `${configuration.app.name}-api`,
      expiresIn: 60,
    }
    const verify = async (token: string) => {
      return type === "access"
        ? service.verifyAccessToken(token)
        : service.verifyRefreshToken(token)
    }
    const error = new UnauthorizedException(
      type === "access"
        ? DICTIONARY.security.accessTokenInvalid
        : DICTIONARY.security.refreshTokenInvalid,
    )

    it.each<[string, JwtSignOptions]>([
      ["чужой секрет", { secret: "wrong-secret" }],
      [
        "секрет другого типа токена",
        {
          secret:
            type === "access"
              ? configuration.jwt.refreshSecret
              : configuration.jwt.accessSecret,
        },
      ],
      ["другой алгоритм", { algorithm: "HS384" }],
      ["другой issuer", { issuer: "another-app" }],
      ["другая audience", { audience: "another-api" }],
      ["истёкший срок", { expiresIn: -1 }],
      ["будущее начало действия", { notBefore: 60 }],
    ])(
      "возвращает 401 при неверных параметрах подписи: %s",
      async (_label, overrides) => {
        const token = await jwt.signAsync(payload, { ...options, ...overrides })

        await expect(verify(token)).rejects.toThrow(error)
      },
    )

    it.each(["", "not-a-jwt", "header.payload.signature"])(
      "возвращает 401 для некорректного токена %p",
      async (token) => {
        await expect(verify(token)).rejects.toThrow(error)
      },
    )

    it.each([
      { type: undefined },
      { type: "other" },
      { type: type === "access" ? "refresh" : "access" },
      { sub: undefined },
      { sub: null },
      { sub: 123 },
      { sessionId: undefined },
      { sessionId: null },
      { sessionId: 123 },
      ...(type === "access"
        ? [{ role: undefined }, { role: null }, { role: ["user"] }]
        : [
            { role: "user" },
            { role: null },
            { roles: ["user"] },
            { roles: null },
          ]),
    ])(
      "возвращает 401 для подписанного токена с некорректными claims %p",
      async (overrides) => {
        const token = await jwt.signAsync({ ...payload, ...overrides }, options)

        await expect(verify(token)).rejects.toThrow(error)
      },
    )
  })
})
