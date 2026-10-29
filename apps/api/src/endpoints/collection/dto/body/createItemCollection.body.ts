import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import {
  IsInt,
  IsMongoId,
  IsString,
  Max,
  Min,
  ValidateIf,
} from "class-validator"

import { isNil } from "@shared/functions/checks/isNil"

class CreateItemCollectionBodyDto {
  @ApiProperty({ type: String, pattern: "^[a-fA-F0-9]{24}$" })
  @IsMongoId()
  itemId: string

  @ApiProperty({ type: String, pattern: "^[a-fA-F0-9]{24}$" })
  @IsMongoId()
  groupId: string

  @ApiProperty({ type: Number, minimum: 0, maximum: Number.MAX_SAFE_INTEGER })
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  position: number

  @ApiPropertyOptional({ type: String, nullable: true })
  @ValidateIf((_object: unknown, value: unknown) => !isNil(value))
  @IsString()
  note?: string | null
}

export { CreateItemCollectionBodyDto }
