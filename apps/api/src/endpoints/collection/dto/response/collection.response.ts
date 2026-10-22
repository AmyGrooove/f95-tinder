import { ApiExtraModels, ApiProperty, getSchemaPath } from "@nestjs/swagger"

import { ECollectionType } from "@entities/collection/schemas/ECollectionType"

import { LanguageTextResponseDto } from "@entities/shared/dto/response/languageText.response"
import { MediaResponseDto } from "@entities/shared/dto/response/media.response"
import { GroupBlockResponseDto } from "./groupBlock.response"
import { TextBlockResponseDto } from "./textBlock.response"

@ApiExtraModels(GroupBlockResponseDto, TextBlockResponseDto)
class CollectionResponseDto {
  @ApiProperty({ type: Number, minimum: 0, maximum: Number.MAX_SAFE_INTEGER })
  version: number

  @ApiProperty({ type: String })
  id: string

  @ApiProperty({ type: String, nullable: true })
  authorId: string | null

  @ApiProperty({ enum: ECollectionType })
  type: ECollectionType

  @ApiProperty({ type: LanguageTextResponseDto })
  title: LanguageTextResponseDto

  @ApiProperty({ type: LanguageTextResponseDto })
  description: LanguageTextResponseDto

  @ApiProperty({ type: [MediaResponseDto] })
  media: MediaResponseDto[]

  @ApiProperty({
    type: "array",
    items: {
      oneOf: [
        { $ref: getSchemaPath(GroupBlockResponseDto) },
        { $ref: getSchemaPath(TextBlockResponseDto) },
      ],
      discriminator: {
        propertyName: "type",
        mapping: {
          group: getSchemaPath(GroupBlockResponseDto),
          text: getSchemaPath(TextBlockResponseDto),
        },
      },
    },
  })
  blocks: (GroupBlockResponseDto | TextBlockResponseDto)[]

  @ApiProperty({ type: String, format: "date-time" })
  createdAt: string

  @ApiProperty({ type: String, format: "date-time" })
  updatedAt: string
}

export { CollectionResponseDto }
