import { ApiSchema } from "@nestjs/swagger"

import { ListGamesQueryDto } from "../../../games/dto/query/list-games.query"

@ApiSchema({ name: "SwipeQueueQuery" })
class SwipeQueueQueryDto extends ListGamesQueryDto {}

export { SwipeQueueQueryDto }
