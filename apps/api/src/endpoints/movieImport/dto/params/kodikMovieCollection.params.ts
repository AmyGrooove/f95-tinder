import { ApiProperty } from "@nestjs/swagger"
import { IsString, Matches } from "class-validator"

import { POSITIVE_INTEGER_REGEX } from "@shared/static/POSITIVE_INTEGER_REGEX"

class KodikMovieCollectionParamsDto {
  @ApiProperty({ pattern: POSITIVE_INTEGER_REGEX.source })
  @IsString()
  @Matches(POSITIVE_INTEGER_REGEX)
  id: string
}

export { KodikMovieCollectionParamsDto }
