import { ApiProperty, ApiPropertyOptional, PickType } from "@nestjs/swagger"
import { Type } from "class-transformer"
import {
  IsArray,
  IsMongoId,
  IsObject,
  IsString,
  ValidateIf,
  ValidateNested,
} from "class-validator"

import { CreateItemCollectionBodyDto } from "./createItemCollection.body"
import { MoveCollectionItemBodyDto } from "./moveCollectionItem.body"

class AddCollectionItemBodyDto extends PickType(CreateItemCollectionBodyDto, [
  "itemId",
  "groupId",
  "note",
] as const) {
  @ApiPropertyOptional({ type: String, nullable: true })
  @ValidateIf(
    (_object: unknown, value: unknown) => value !== null && value !== undefined,
  )
  @IsMongoId()
  beforeItemId?: string | null
}

class UpdateCollectionItemBodyDto extends PickType(
  CreateItemCollectionBodyDto,
  ["itemId"] as const,
) {
  @ApiProperty({ type: String, nullable: true })
  @ValidateIf((_object: unknown, value: unknown) => value !== null)
  @IsString()
  note: string | null
}

class CollectionItemChangesBodyDto {
  @ApiPropertyOptional({ type: [AddCollectionItemBodyDto] })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsArray()
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => AddCollectionItemBodyDto)
  add?: AddCollectionItemBodyDto[]

  @ApiPropertyOptional({ type: [UpdateCollectionItemBodyDto] })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsArray()
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => UpdateCollectionItemBodyDto)
  update?: UpdateCollectionItemBodyDto[]

  @ApiPropertyOptional({ type: [MoveCollectionItemBodyDto] })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsArray()
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => MoveCollectionItemBodyDto)
  move?: MoveCollectionItemBodyDto[]

  @ApiPropertyOptional({ type: [String] })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsArray()
  @IsMongoId({ each: true })
  remove?: string[]
}

export { CollectionItemChangesBodyDto }
