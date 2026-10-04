# Security

Read for authentication, roles, token creation or rate limits. HTTP/CORS configuration is in [runtime](runtime.md).

[SecurityModule](../../src/infrastructure/security/security.module.ts) exports `SecurityJwtService`, `AccessTokenGuard` and `RolesGuard`. It is not imported by the current application graph; none of these guards is configured as the global application authentication guard.

[SecurityJwtService](../../src/infrastructure/security/services/jwt.service.ts) signs/verifies access and refresh tokens using separate configured secrets and HS256. Access expiration is 15 minutes; refresh expiration is 30 days. Issuer is the app name and audience is `<appName>-api`. Access payloads carry `sub`, `sessionId`, `roles` and `type: "access"`; refresh payloads carry `sub`, `sessionId`, `type: "refresh"` and are rejected if they contain `roles`. Verification checks token type and payload field types and converts failures into UnauthorizedException.

[AccessTokenGuard](../../src/infrastructure/security/guards/accessToken.guard.ts) requires a single Bearer token and stores `{ id, sessionId, roles }` on `request.authPrincipal`. [CurrentUser](../../src/infrastructure/security/decorators/CurrentUser/core/CurrentUser.ts) reads this principal. These objects do not query a user/session database or establish refresh rotation, logout or revocation semantics.

[Roles](../../src/infrastructure/security/decorators/Roles/core/Roles.ts) sets metadata consumed by [RolesGuard](../../src/infrastructure/security/guards/roles.guard.ts). Method metadata takes priority over controller metadata. Empty/missing roles permit access; otherwise any matching principal role is sufficient. Run the access guard before the roles guard for a protected endpoint.

Password helpers already exist as [hashValue](../../src/infrastructure/security/functions/hashValue/core/hashValue.ts) and [compareHash](../../src/infrastructure/security/functions/compareHash/core/compareHash.ts); inspect them before adding another hashing implementation.

[ThrottlingModule](../../src/infrastructure/throttling/throttling.module.ts), unlike SecurityModule, is imported by AppModule and registers a global `ThrottlerGuard` with Redis storage. Its [default](../../src/infrastructure/throttling/static/THROTTLE_DEFAULTS.ts) is 100 requests per 60,000 ms. Health routes currently have no local throttling exemption.
