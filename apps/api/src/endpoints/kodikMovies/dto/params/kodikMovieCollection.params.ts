import { ApiProperty } from "@nestjs/swagger"
import { IsString, Matches } from "class-validator"

class KodikMovieCollectionParamsDto {
  @ApiProperty({ pattern: "^[1-9]\\d*$" })
  @IsString()
  @Matches(/^[1-9]\d*$/)
  id: string
}

export { KodikMovieCollectionParamsDto }
