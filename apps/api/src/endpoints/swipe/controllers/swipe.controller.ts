import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common"
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger"

import { AccessTokenGuard } from "@infrastructure/security/guards/accessToken.guard"
import { CurrentUser } from "@infrastructure/security/decorators/CurrentUser"

import { SwipeGameIdParamsDto } from "../dto/params/game-id.params"
import { SwipeQueueQueryDto } from "../dto/query/swipe-queue.query"
import { SwipeQueueResponseDto } from "../dto/response/swipe-queue.response"
import { SwipeService } from "../services/swipe.service"
import { LibraryGameStateResponseDto } from "../../library/dto/response/library-info.response"

@ApiTags("Swipe")
@ApiBearerAuth("authToken")
@UseGuards(AccessTokenGuard)
@Controller("swipe")
class SwipeController {
  constructor(private readonly swipeService: SwipeService) {}

  @Get("queue")
  @ApiOperation({ summary: "Get current user swipe queue" })
  @ApiOkResponse({ type: SwipeQueueResponseDto })
  getQueue(
    @CurrentUser("id") userId: string,
    @Query() query: SwipeQueueQueryDto,
  ): Promise<SwipeQueueResponseDto> {
    return this.swipeService.getQueue(userId, query)
  }

  @Post(":gameId/favorite")
  @ApiOperation({ summary: "Mark a game as favorite from swipe" })
  @ApiOkResponse({ type: LibraryGameStateResponseDto })
  markFavorite(
    @CurrentUser("id") userId: string,
    @Param() params: SwipeGameIdParamsDto,
  ): Promise<LibraryGameStateResponseDto> {
    return this.swipeService.updateGameState(userId, params.gameId, "favorite")
  }

  @Post(":gameId/trash")
  @ApiOperation({ summary: "Mark a game as trash from swipe" })
  @ApiOkResponse({ type: LibraryGameStateResponseDto })
  markTrash(
    @CurrentUser("id") userId: string,
    @Param() params: SwipeGameIdParamsDto,
  ): Promise<LibraryGameStateResponseDto> {
    return this.swipeService.updateGameState(userId, params.gameId, "trash")
  }

  @Post(":gameId/played")
  @ApiOperation({ summary: "Mark a game as played from swipe" })
  @ApiOkResponse({ type: LibraryGameStateResponseDto })
  markPlayed(
    @CurrentUser("id") userId: string,
    @Param() params: SwipeGameIdParamsDto,
  ): Promise<LibraryGameStateResponseDto> {
    return this.swipeService.updateGameState(userId, params.gameId, "played")
  }
}

export { SwipeController }
