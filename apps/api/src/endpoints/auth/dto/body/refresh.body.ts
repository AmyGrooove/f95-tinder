import { ApiProperty, ApiSchema } from "@nestjs/swagger"
import { IsString } from "class-validator"

@ApiSchema({ name: "RefreshBody" })
class RefreshBodyDto {
  @ApiProperty({ description: "Refresh token" })
  @IsString()
  refreshToken!: string
}

export { RefreshBodyDto }
