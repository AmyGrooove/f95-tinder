import { Controller, Get, Param, Query } from "@nestjs/common"
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger"

import { GameIdParamsDto } from "../dto/params/game-id.params"
import { ListGamesQueryDto } from "../dto/query/list-games.query"
import {
  CreatorListResponseDto,
  GameListResponseDto,
  GameResponseDto,
  PrefixListResponseDto,
  TagListResponseDto,
} from "../dto/response/game-list.response"
import { GamesService } from "../services/games.service"

@ApiTags("Games")
@Controller()
class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Get("games")
  @ApiOperation({ summary: "List catalog games" })
  @ApiOkResponse({ type: GameListResponseDto })
  listGames(@Query() query: ListGamesQueryDto): Promise<GameListResponseDto> {
    return this.gamesService.listGames(query)
  }

  @Get("games/latest")
  @ApiOperation({ summary: "List latest catalog games" })
  @ApiOkResponse({ type: GameListResponseDto })
  listLatestGames(
    @Query() query: ListGamesQueryDto,
  ): Promise<GameListResponseDto> {
    return this.gamesService.listLatestGames(query)
  }

  @Get("games/:id")
  @ApiOperation({ summary: "Get a catalog game" })
  @ApiOkResponse({ type: GameResponseDto })
  getGame(@Param() params: GameIdParamsDto): Promise<GameResponseDto> {
    return this.gamesService.getGame(params.id)
  }

  @Get("tags")
  @ApiOperation({ summary: "List seeded tags" })
  @ApiOkResponse({ type: TagListResponseDto })
  listTags(): Promise<TagListResponseDto> {
    return this.gamesService.listTags()
  }

  @Get("prefixes")
  @ApiOperation({ summary: "List seeded prefixes" })
  @ApiOkResponse({ type: PrefixListResponseDto })
  listPrefixes(): Promise<PrefixListResponseDto> {
    return this.gamesService.listPrefixes()
  }

  @Get("creators")
  @ApiOperation({ summary: "List creators" })
  @ApiOkResponse({ type: CreatorListResponseDto })
  listCreators(): Promise<CreatorListResponseDto> {
    return this.gamesService.listCreators()
  }
}

export { GamesController }
