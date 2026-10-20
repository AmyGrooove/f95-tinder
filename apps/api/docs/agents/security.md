# Security

Read for authentication, roles, token creation or rate limits. HTTP/CORS configuration is in [runtime](runtime.md).

[SecurityModule](../../src/infrastructure/security/security.module.ts) exports `SecurityJwtService`, `SecurityCookieService`, `AccessTokenGuard` and `RolesGuard`. [MovieImportModule](../../src/endpoints/movieImport/movieImport.module.ts) imports it and protects its controller with `AccessTokenGuard`, then `RolesGuard`, and `@Roles(EUserRole.ADMIN)`. None of these guards is configured as the global application authentication guard.

[SecurityCookieService.setAuthCookies(reply, tokens)](../../src/infrastructure/security/services/cookie.service.ts) uses Nest's HttpAdapterHost to set `__Host-accessToken` and `__Host-refreshToken` with HttpOnly, Secure, SameSite=Strict and Path=/. Max-Age values reuse the JWT expiration constants in seconds. Controllers pass the native response through `@Res({ passthrough: true })` and an IAuthTokens object; the service does not issue tokens or create server sessions.

[SecurityJwtService](../../src/infrastructure/security/services/jwt.service.ts) signs/verifies access and refresh tokens using separate configured secrets and HS256. Access expiration is 600 seconds (10 minutes); refresh expiration is 10,368,000 seconds (120 days). Both expiration constants use seconds and are shared with registration cookie lifetimes. Issuer is the app name and audience is `<appName>-api`. Access payloads carry `sub`, `sessionId`, a single `role: string` and `type: "access"`; refresh payloads carry `sub`, `sessionId`, `type: "refresh"` and are rejected if they contain `role` or the legacy `roles` field. Verification checks token type and payload field types and converts failures into UnauthorizedException.

[AccessTokenGuard](../../src/infrastructure/security/guards/accessToken.guard.ts) requires a single Bearer token and stores `{ id, sessionId, role }` on `request.authPrincipal`. [CurrentUser](../../src/infrastructure/security/decorators/CurrentUser/core/CurrentUser.ts) reads this principal. These objects do not query a user/session database or establish refresh rotation, logout or revocation semantics.

[Roles](../../src/infrastructure/security/decorators/Roles/core/Roles.ts) sets metadata consumed by [RolesGuard](../../src/infrastructure/security/guards/roles.guard.ts). Method metadata takes priority over controller metadata. Empty/missing roles permit access; otherwise the principal's single role must be included in the allowed role list. Access JWTs carrying only the former `roles` array are rejected; callers need a newly issued access token. Run the access guard before the roles guard for a protected endpoint.

Password helpers already exist as [hashValue](../../src/infrastructure/security/functions/hashValue/core/hashValue.ts) and [compareHash](../../src/infrastructure/security/functions/compareHash/core/compareHash.ts); inspect them before adding another hashing implementation.

[ThrottlingModule](../../src/infrastructure/throttling/throttling.module.ts), unlike SecurityModule, is imported by AppModule and registers a global `ThrottlerGuard` with Redis storage. Its [default](../../src/infrastructure/throttling/static/THROTTLE_DEFAULTS.ts) is 100 requests per 60,000 ms. Health routes currently have no local throttling exemption.

## MVP persistence boundary

[User](../../src/entities/user/schemas/user.schema.ts) retains accessCodeHash and passwordHash with select:false; credentialVersion, revision/actionSequence, accessCodeChangedAt, catalogPermissions and locale were removed. [Session](../../src/entities/session/schemas/session.schema.ts) retains user, refreshTokenHash (select:false), userAgent, expiresAt and lastUsedAt; rotation/jti/issuedAt/revision/revoke/receipt fields were removed. UserSetting owns required ELocale.RU/EN with default:ELocale.RU; locale is optional in TCreateUserSetting. Its unique user index is named userSettingUnique. Linked providers remain Google and Yandex; source changes do not migrate stored documents.

RecoveryChallenge/durable delivery reference is a schema/repository only. The OAuthAttempt entity was removed from the MVP; OAuth state storage and reauth binding must be designed when implementing authentication. Encrypted metadata holds ciphertext/iv/authTag/keyVersion; no crypto implementation, provider call, token issuance, recovery mail, HTTP endpoint or live-session guard was introduced. User has a local toJSON transform removing passwordHash and accessCodeHash, composed with the global JSON plugin. Session has no local hash-removal transform; select:false affects default queries only. Lean, aggregate, toObject and raw document fields still need an explicit transport allowlist.

The JWT helper and persistence fields alone do not implement refresh rotation or rolling-session renewal. Session lifecycle belongs to the auth endpoint layer, not the security infrastructure guards.
