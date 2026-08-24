import { ApiProperty, ApiSchema } from "@nestjs/swagger"

import { GameResponseDto } from "../../../games/dto/response/game-list.response"

@ApiSchema({ name: "SwipeQueueResponse" })
class SwipeQueueResponseDto {
  @ApiProperty({ type: [GameResponseDto] })
  items!: GameResponseDto[]

  @ApiProperty()
  count!: number

  @ApiProperty({ nullable: true })
  nextCursor!: string | null
}

export { SwipeQueueResponseDto }
