import type { Types } from "mongoose"
import type { ListGamesQueryDto } from "../../../dto/query/list-games.query"

interface ICreateGameFilterProps {
  query: ListGamesQueryDto

  creatorIds?: Types.ObjectId[]
  excludedGameIds?: Types.ObjectId[]
}

export type { ICreateGameFilterProps }
