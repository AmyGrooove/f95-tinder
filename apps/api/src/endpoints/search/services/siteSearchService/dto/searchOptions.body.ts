import { IntersectionType, PickType } from "@nestjs/swagger"

import { ECollectionType } from "@entities/collection/schemas/ECollectionType"
import { ValueFilterProperty } from "@entities/shared/decorators/ValueFilterProperty"
import { QueryFieldsDto } from "@entities/shared/dto/query/queryFields.dto"
import { createSortDto } from "@entities/shared/functions/createSortDto"
import { ESort } from "@entities/shared/types/ESort"
import type { ValueFilter } from "@entities/shared/types/ValueFilter"

class SearchItemsBodyDto extends IntersectionType(
  PickType(QueryFieldsDto, ["types", "rating"]),
  createSortDto([
    ESort.RELEVANCE,
    ESort.TITLE,
    ESort.RELEASE_DATE,
    ESort.LATEST_RELEASE_DATE,
    ESort.RATING,
  ]),
) {
  @ValueFilterProperty({})
  tags?: ValueFilter<string>
}

class SearchCollectionsBodyDto extends createSortDto([
  ESort.RELEVANCE,
  ESort.TITLE,
  ESort.UPDATED_AT,
]) {
  @ValueFilterProperty({ values: Object.values(ECollectionType) })
  collectionTypes?: ValueFilter<ECollectionType>
}

class SearchUsersBodyDto extends createSortDto([
  ESort.RELEVANCE,
  ESort.DISPLAY_NAME,
]) {}

export { SearchCollectionsBodyDto, SearchItemsBodyDto, SearchUsersBodyDto }
