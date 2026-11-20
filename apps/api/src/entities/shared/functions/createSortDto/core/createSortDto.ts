import type { Type } from "@nestjs/common"
import { ApiPropertyOptional, PickType } from "@nestjs/swagger"
import { IsIn } from "class-validator"

import { QueryFieldsDto } from "../../../dto/query/queryFields.dto"
import { ESort } from "../../../types/ESort"

const createSortDto = <TSort extends ESort>(
  allowed: readonly TSort[],
): Type<
  Pick<QueryFieldsDto, "direction"> & {
    sort?: TSort
  } & (ESort.TITLE extends TSort ? Pick<QueryFieldsDto, "language"> : object)
> => {
  const keys = (allowed as readonly ESort[]).includes(ESort.TITLE)
    ? (["sort", "direction", "language"] as const)
    : (["sort", "direction"] as const)

  class SortDto extends PickType(QueryFieldsDto, keys) {
    @ApiPropertyOptional({ enum: allowed, type: String })
    @IsIn(allowed)
    declare sort?: TSort
  }

  return SortDto
}

export { createSortDto }
