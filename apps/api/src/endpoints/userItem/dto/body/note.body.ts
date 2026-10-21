import { ApiProperty } from "@nestjs/swagger"
import { IsString, ValidateIf } from "class-validator"

class NoteBodyDto {
  @ApiProperty({ type: String, nullable: true })
  @ValidateIf((_object: unknown, value: unknown) => value !== null)
  @IsString()
  note: string | null
}

export { NoteBodyDto }
