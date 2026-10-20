import { ApiProperty } from "@nestjs/swagger"

import { EUserRole } from "@entities/user/schemas/EUserRole"

class WhoamiUserResponseDto {
  @ApiProperty({ description: "Идентификатор пользователя" })
  id: string

  @ApiProperty({ description: "Логин", example: "quietfox042" })
  username: string

  @ApiProperty({ description: "Отображаемое имя", example: "quietFox042" })
  displayName: string

  @ApiProperty({ description: "URL аватара", type: String, nullable: true })
  avatarUrl: string | null

  @ApiProperty({ description: "Роль пользователя", enum: EUserRole })
  role: EUserRole
}

export { WhoamiUserResponseDto }
