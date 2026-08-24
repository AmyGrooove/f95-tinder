import { ApiProperty, ApiPropertyOptional, ApiSchema } from "@nestjs/swagger"

import {
  USER_ROLES,
  type TUserRole,
} from "@entities/user/schemas/userRole.schema"
import {
  USER_STATUSES,
  type TUserStatus,
} from "@entities/user/schemas/userStatus.schema"

@ApiSchema({ name: "AuthUser" })
class AuthUserDto {
  @ApiProperty({ description: "User identifier" })
  id!: string

  @ApiProperty({ description: "User email address" })
  email!: string

  @ApiProperty({ description: "Displayed user name" })
  displayName!: string

  @ApiProperty({ description: "User role", enum: USER_ROLES })
  role!: TUserRole

  @ApiProperty({ description: "User status", enum: USER_STATUSES })
  status!: TUserStatus

  @ApiPropertyOptional({
    description: "Last successful login date",
    nullable: true,
  })
  lastLoginAt!: Date | null
}

@ApiSchema({ name: "AuthSessionResponse" })
class AuthSessionResponseDto {
  @ApiProperty({ description: "Access token" })
  accessToken!: string

  @ApiProperty({ description: "Refresh token" })
  refreshToken!: string

  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto
}

export { AuthSessionResponseDto, AuthUserDto }
