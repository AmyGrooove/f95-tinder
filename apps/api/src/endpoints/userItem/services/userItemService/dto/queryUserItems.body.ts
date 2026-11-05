import { ApiProperty } from "@nestjs/swagger"
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsMongoId,
} from "class-validator"

import { isString } from "@shared/functions/checks/isString"

class QueryUserItemsBodyDto {
  @ApiProperty({
    type: [String],
    minItems: 1,
    maxItems: 60,
    uniqueItems: true,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(60)
  @ArrayUnique((id: unknown) => (isString(id) ? id.toLowerCase() : id))
  @IsMongoId({ each: true })
  ids: string[]
}

export { QueryUserItemsBodyDto }
