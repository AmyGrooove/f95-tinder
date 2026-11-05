import { PartialType } from "@nestjs/swagger"

import { CreateAttemptBodyDto } from "./createAttempt.body"

class UpdateAttemptBodyDto extends PartialType(CreateAttemptBodyDto, {
  skipNullProperties: false,
}) {}

export { UpdateAttemptBodyDto }
