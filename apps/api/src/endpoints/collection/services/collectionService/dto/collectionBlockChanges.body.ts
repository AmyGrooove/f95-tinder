import {
  ApiProperty,
  ApiPropertyOptional,
  IntersectionType,
  PickType,
} from "@nestjs/swagger"
import { Type } from "class-transformer"
import {
  IsArray,
  IsMongoId,
  IsObject,
  ValidateIf,
  ValidateNested,
} from "class-validator"

import { isNil } from "@shared/functions/checks/isNil"
import { isUndefined } from "@shared/functions/checks/isUndefined"

import { CreateBlockBodyDto } from "./createBlock.body"

class CollectionBlockIdBodyDto {
  @ApiProperty({ type: String })
  @IsMongoId()
  id: string
}

class CollectionBlockInsertionBodyDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  @ValidateIf((_object: unknown, value: unknown) => !isNil(value))
  @IsMongoId()
  beforeBlockId?: string | null
}

class AddCollectionBlockBodyDto extends IntersectionType(
  CollectionBlockIdBodyDto,
  IntersectionType(
    PickType(CreateBlockBodyDto, [
      "type",
      "title",
      "description",
      "content",
    ] as const),
    CollectionBlockInsertionBodyDto,
  ),
) {}

class UpdateCollectionBlockBodyDto extends IntersectionType(
  CollectionBlockIdBodyDto,
  PickType(CreateBlockBodyDto, ["title", "description", "content"] as const),
) {}

class MoveCollectionBlockBodyDto extends CollectionBlockIdBodyDto {
  @ApiProperty({ type: String, nullable: true })
  @ValidateIf((_object: unknown, value: unknown) => value !== null)
  @IsMongoId()
  beforeBlockId: string | null
}

class CollectionBlockChangesBodyDto {
  @ApiPropertyOptional({ type: [AddCollectionBlockBodyDto] })
  @ValidateIf((_object: unknown, value: unknown) => !isUndefined(value))
  @IsArray()
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => AddCollectionBlockBodyDto)
  add?: AddCollectionBlockBodyDto[]

  @ApiPropertyOptional({ type: [UpdateCollectionBlockBodyDto] })
  @ValidateIf((_object: unknown, value: unknown) => !isUndefined(value))
  @IsArray()
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => UpdateCollectionBlockBodyDto)
  update?: UpdateCollectionBlockBodyDto[]

  @ApiPropertyOptional({ type: [MoveCollectionBlockBodyDto] })
  @ValidateIf((_object: unknown, value: unknown) => !isUndefined(value))
  @IsArray()
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => MoveCollectionBlockBodyDto)
  move?: MoveCollectionBlockBodyDto[]

  @ApiPropertyOptional({ type: [String] })
  @ValidateIf((_object: unknown, value: unknown) => !isUndefined(value))
  @IsArray()
  @IsMongoId({ each: true })
  remove?: string[]
}

export { CollectionBlockChangesBodyDto }
