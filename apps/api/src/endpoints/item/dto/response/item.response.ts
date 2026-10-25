import { ApiProperty } from "@nestjs/swagger"

import { EFeatureValueType } from "@entities/feature/schemas/EFeatureValueType"
import { EItemType } from "@entities/item/schemas/EItemType"
import { LanguageTextResponseDto } from "@entities/shared/dto/response/languageText.response"
import { MediaResponseDto } from "@entities/shared/dto/response/media.response"
import { EUnit } from "@entities/shared/schemas/EUnit"
import { SWAGGER_DICTIONARY } from "@entities/shared/static/SWAGGER_DICTIONARY"
import { ETagGroup } from "@entities/tag/schemas/ETagGroup"

class ItemSummaryResponseDto {
  @ApiProperty({ type: String })
  id: string

  @ApiProperty({ enum: EItemType })
  type: EItemType

  @ApiProperty({ type: LanguageTextResponseDto })
  title: LanguageTextResponseDto

  @ApiProperty({ type: [MediaResponseDto] })
  media: MediaResponseDto[]
}

class ItemTagResponseDto {
  @ApiProperty({ type: String })
  id: string

  @ApiProperty({ type: String })
  key: string

  @ApiProperty({ enum: ETagGroup, nullable: true })
  group: ETagGroup | null

  @ApiProperty({ type: LanguageTextResponseDto })
  name: LanguageTextResponseDto
}

class ItemFeatureResponseDto {
  @ApiProperty({ type: String })
  id: string

  @ApiProperty({ type: String })
  key: string

  @ApiProperty({ type: LanguageTextResponseDto })
  name: LanguageTextResponseDto

  @ApiProperty({ enum: EFeatureValueType })
  valueType: EFeatureValueType

  @ApiProperty({ enum: EUnit, nullable: true })
  unit: EUnit | null

  @ApiProperty({
    oneOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
    description: SWAGGER_DICTIONARY.item.featureValue,
  })
  value: string | number | boolean
}

class ItemRelationRoleResponseDto {
  @ApiProperty({ type: String })
  id: string

  @ApiProperty({ type: String })
  key: string

  @ApiProperty({
    type: LanguageTextResponseDto,
    description: SWAGGER_DICTIONARY.item.roleName,
  })
  name: LanguageTextResponseDto
}

class ItemRelationResponseDto {
  @ApiProperty({ type: ItemSummaryResponseDto })
  item: ItemSummaryResponseDto

  @ApiProperty({
    type: ItemRelationRoleResponseDto,
    description: SWAGGER_DICTIONARY.item.relatedRole,
  })
  role: ItemRelationRoleResponseDto
}

class ItemResponseDto extends ItemSummaryResponseDto {
  @ApiProperty({ type: LanguageTextResponseDto })
  description: LanguageTextResponseDto

  @ApiProperty({ type: [String] })
  aliases: string[]

  @ApiProperty({
    type: [ItemTagResponseDto],
    description: SWAGGER_DICTIONARY.item.tagsOrder,
  })
  tags: ItemTagResponseDto[]

  @ApiProperty({
    type: [ItemFeatureResponseDto],
    description: SWAGGER_DICTIONARY.item.featuresOrder,
  })
  features: ItemFeatureResponseDto[]

  @ApiProperty({
    type: [ItemRelationResponseDto],
    description: SWAGGER_DICTIONARY.item.relationsOrder,
  })
  relations: ItemRelationResponseDto[]
}

export { ItemResponseDto }
