import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  UseGuards,
} from "@nestjs/common"
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger"

import { AccessTokenGuard } from "@infrastructure/security/guards/accessToken.guard"
import { CurrentUser } from "@infrastructure/security/decorators/CurrentUser"

import { UpdateGameStateBodyDto } from "../dto/body/update-game-state.body"
import { LibraryGameIdParamsDto } from "../dto/params/game-id.params"
import {
  LibraryGameListResponseDto,
  LibraryGameStateResponseDto,
  LibraryInfoResponseDto,
} from "../dto/response/library-info.response"
import { LibraryService } from "../services/library.service"

@ApiTags("Library")
@ApiBearerAuth("authToken")
@UseGuards(AccessTokenGuard)
@Controller("me")
class LibraryController {
  constructor(private readonly libraryService: LibraryService) {}

  @Get("library/info")
  @ApiOperation({ summary: "Get current user library counters" })
  @ApiOkResponse({ type: LibraryInfoResponseDto })
  getLibraryInfo(
    @CurrentUser("id") userId: string,
  ): Promise<LibraryInfoResponseDto> {
    return this.libraryService.getLibraryInfo(userId)
  }

  @Get("library/favorites")
  @ApiOperation({ summary: "List favorite games" })
  @ApiOkResponse({ type: LibraryGameListResponseDto })
  listFavorites(
    @CurrentUser("id") userId: string,
  ): Promise<LibraryGameListResponseDto> {
    return this.libraryService.listLibraryGames(userId, "favorite")
  }

  @Get("library/trash")
  @ApiOperation({ summary: "List trashed games" })
  @ApiOkResponse({ type: LibraryGameListResponseDto })
  listTrash(
    @CurrentUser("id") userId: string,
  ): Promise<LibraryGameListResponseDto> {
    return this.libraryService.listLibraryGames(userId, "trash")
  }

  @Get("library/played")
  @ApiOperation({ summary: "List played games" })
  @ApiOkResponse({ type: LibraryGameListResponseDto })
  listPlayed(
    @CurrentUser("id") userId: string,
  ): Promise<LibraryGameListResponseDto> {
    return this.libraryService.listLibraryGames(userId, "played")
  }

  @Patch("games/:gameId/state")
  @ApiOperation({ summary: "Move a game into a user library list" })
  @ApiOkResponse({ type: LibraryGameStateResponseDto })
  updateGameState(
    @CurrentUser("id") userId: string,
    @Param() params: LibraryGameIdParamsDto,
    @Body() body: UpdateGameStateBodyDto,
  ): Promise<LibraryGameStateResponseDto> {
    return this.libraryService.updateGameState(
      userId,
      params.gameId,
      body.listType,
    )
  }

  @Delete("games/:gameId")
  @HttpCode(204)
  @ApiOperation({ summary: "Remove a game from the current user library" })
  deleteGameState(
    @CurrentUser("id") userId: string,
    @Param() params: LibraryGameIdParamsDto,
  ): Promise<void> {
    return this.libraryService.deleteGameState(userId, params.gameId)
  }
}

export { LibraryController }
