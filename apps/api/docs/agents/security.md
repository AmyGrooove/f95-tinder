# Security

Read for authentication, roles, token creation or rate limits. HTTP/CORS configuration is in [runtime](runtime.md).

[SecurityModule](../../src/infrastructure/security/security.module.ts) exports `SecurityJwtService`, `AccessTokenGuard` and `RolesGuard`. It is not imported by the current application graph; none of these guards is configured as the global application authentication guard.

[SecurityJwtService](../../src/infrastructure/security/services/jwt.service.ts) signs/verifies access and refresh tokens using separate configured secrets and HS256. Access expiration is 15 minutes; refresh expiration is 30 days. Issuer is the app name and audience is `<appName>-api`. Access payloads carry `sub`, `sessionId`, `roles` and `type: "access"`; refresh payloads carry `sub`, `sessionId`, `type: "refresh"` and are rejected if they contain `roles`. Verification checks token type and payload field types and converts failures into UnauthorizedException.

[AccessTokenGuard](../../src/infrastructure/security/guards/accessToken.guard.ts) requires a single Bearer token and stores `{ id, sessionId, roles }` on `request.authPrincipal`. [CurrentUser](../../src/infrastructure/security/decorators/CurrentUser/core/CurrentUser.ts) reads this principal. These objects do not query a user/session database or establish refresh rotation, logout or revocation semantics.

[Roles](../../src/infrastructure/security/decorators/Roles/core/Roles.ts) sets metadata consumed by [RolesGuard](../../src/infrastructure/security/guards/roles.guard.ts). Method metadata takes priority over controller metadata. Empty/missing roles permit access; otherwise any matching principal role is sufficient. Run the access guard before the roles guard for a protected endpoint.

Password helpers already exist as [hashValue](../../src/infrastructure/security/functions/hashValue/core/hashValue.ts) and [compareHash](../../src/infrastructure/security/functions/compareHash/core/compareHash.ts); inspect them before adding another hashing implementation.

[ThrottlingModule](../../src/infrastructure/throttling/throttling.module.ts), unlike SecurityModule, is imported by AppModule and registers a global `ThrottlerGuard` with Redis storage. Its [default](../../src/infrastructure/throttling/static/THROTTLE_DEFAULTS.ts) is 100 requests per 60,000 ms. Health routes currently have no local throttling exemption.

## MVP persistence boundary

[User](../../src/entities/user/schemas/user.schema.ts) retains accessCodeHash and passwordHash with select:false; credentialVersion, revision/actionSequence, accessCodeChangedAt, catalogPermissions and locale were removed. [Session](../../src/entities/session/schemas/session.schema.ts) retains user, refreshTokenHash (select:false), userAgent, expiresAt and lastUsedAt; rotation/jti/issuedAt/revision/revoke/receipt fields were removed. UserSetting owns required ELocale.RU/EN. Linked providers remain Google and Yandex; source changes do not migrate stored documents.

RecoveryChallenge/durable delivery reference is a schema/repository only. The OAuthAttempt entity was removed from the MVP; OAuth state storage and reauth binding must be designed when implementing authentication. Encrypted metadata holds ciphertext/iv/authTag/keyVersion; no crypto implementation, provider call, token issuance, recovery mail, HTTP endpoint or live-session guard was introduced. User and Session local toJSON transforms were removed; select:false affects default queries only. Explicit selections, create results, lean and aggregate output need an explicit transport allowlist.

The JWT helper above still uses 30-day refresh expiration; persistence fields alone do not implement the agreed four-month rolling session. Authentication behavior and settings belong to P3.
