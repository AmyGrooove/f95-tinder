import { ApiProperty } from "@nestjs/swagger"
import { IsInt, Max, Min, ValidateIf } from "class-validator"

class RatingBodyDto {
  @ApiProperty({ type: Number, minimum: 1, maximum: 10, nullable: true })
  @ValidateIf((_object: unknown, value: unknown) => value !== null)
  @IsInt()
  @Min(1)
  @Max(10)
  rating: number | null
}

export { RatingBodyDto }
