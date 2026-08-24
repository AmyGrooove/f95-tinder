import { ApiProperty, ApiSchema } from "@nestjs/swagger"
import { IsIn } from "class-validator"

import {
  USER_GAME_LIST_TYPES,
  type TUserGameListType,
} from "@entities/userGameState/types/TUserGameListType"

@ApiSchema({ name: "UpdateGameStateBody" })
class UpdateGameStateBodyDto {
  @ApiProperty({
    description: "Target library list type",
    enum: USER_GAME_LIST_TYPES,
  })
  @IsIn(USER_GAME_LIST_TYPES)
  listType!: TUserGameListType
}

export { UpdateGameStateBodyDto }
