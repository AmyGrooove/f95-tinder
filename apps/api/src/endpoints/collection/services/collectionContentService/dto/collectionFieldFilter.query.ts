import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { Allow, IsEnum } from "class-validator"
import { EItemField } from "@entities/item/schemas/EItemField"

class CollectionFieldFilterQueryDto {
  @ApiProperty({ enum: EItemField })
  @IsEnum(EItemField)
  field: EItemField

  @ApiPropertyOptional({
    oneOf: [{ type: "number" }, { type: "string", format: "date-time" }],
  })
  @Allow()
  min?: unknown

  @ApiPropertyOptional({
    oneOf: [{ type: "number" }, { type: "string", format: "date-time" }],
  })
  @Allow()
  max?: unknown
}

export { CollectionFieldFilterQueryDto }
