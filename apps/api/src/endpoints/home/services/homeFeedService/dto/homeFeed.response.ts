import { ApiExtraModels, ApiProperty, getSchemaPath } from "@nestjs/swagger"

import { SWAGGER_DICTIONARY } from "@endpoints/shared/static/SWAGGER_DICTIONARY"
import { REGEX } from "@shared/static/REGEX"

import { HOME_FEED_BLOCK_ORDER } from "../static/HOME_FEED_BLOCK_ORDER"
import { EHomeFeedBlockType } from "../types/EHomeFeedBlockType"

class HomeFeedFactResponseDto {
  @ApiProperty({ type: String, enum: [EHomeFeedBlockType.FACT] })
  type: EHomeFeedBlockType.FACT

  @ApiProperty({ type: String, pattern: REGEX.MONGO_OBJECT_ID.source })
  id: string
}

class HomeFeedCollectionResponseDto {
  @ApiProperty({ type: String, enum: [EHomeFeedBlockType.COLLECTION] })
  type: EHomeFeedBlockType.COLLECTION

  @ApiProperty({ type: String, pattern: REGEX.MONGO_OBJECT_ID.source })
  id: string
}

@ApiExtraModels(HomeFeedFactResponseDto, HomeFeedCollectionResponseDto)
class HomeFeedResponseDto {
  @ApiProperty({
    type: String,
    format: "date",
    pattern: REGEX.ISO_DATE.source,
    description: SWAGGER_DICTIONARY.home.feedDate,
  })
  date: string

  @ApiProperty({
    type: "array",
    maxItems: HOME_FEED_BLOCK_ORDER.length,
    uniqueItems: true,
    description: SWAGGER_DICTIONARY.home.feedBlocks,
    items: {
      oneOf: [
        { $ref: getSchemaPath(HomeFeedFactResponseDto) },
        { $ref: getSchemaPath(HomeFeedCollectionResponseDto) },
      ],
      discriminator: {
        propertyName: "type",
        mapping: {
          [EHomeFeedBlockType.FACT]: getSchemaPath(HomeFeedFactResponseDto),
          [EHomeFeedBlockType.COLLECTION]: getSchemaPath(
            HomeFeedCollectionResponseDto,
          ),
        },
      },
    },
  })
  blocks: (HomeFeedFactResponseDto | HomeFeedCollectionResponseDto)[]
}

export { HomeFeedResponseDto }
