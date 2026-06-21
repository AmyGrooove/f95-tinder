import type { UserGameStatus } from '@f95/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUserId } from '../../../infrastructure/security/decorators/CurrentUserId';
import { BearerTokenGuard } from '../../../infrastructure/security/guards/bearerToken.guard';
import { ListQueryDto } from '../dto/listQuery.dto';
import {
  DeleteGameStatusResponseDto,
  UpdateGameStatusBodyDto,
  UpdateGameStatusResponseDto,
} from '../dto/updateGameStatusBody.dto';
import { ListsService } from '../services/lists.service';

const USER_GAME_STATUS = {
  bookmark: 'bookmark',
  trash: 'trash',
  played: 'played',
} as const;

@Controller('lists')
@UseGuards(BearerTokenGuard)
export class ListsController {
  constructor(private readonly listsService: ListsService) {}

  @Get(':status')
  getList(
    @CurrentUserId() userId: string,
    @Param('status', new ParseEnumPipe(USER_GAME_STATUS))
    status: UserGameStatus,
    @Query() query: ListQueryDto,
  ) {
    return this.listsService.getList(
      userId,
      status,
      query.limit,
      query.cursor,
    );
  }

  @Patch('games/:gameId')
  updateStatus(
    @CurrentUserId() userId: string,
    @Param('gameId') gameId: string,
    @Body() body: UpdateGameStatusBodyDto,
  ): Promise<UpdateGameStatusResponseDto> {
    return this.listsService.updateStatus(userId, gameId, body.status);
  }

  @Delete('games/:gameId')
  @HttpCode(HttpStatus.OK)
  deleteStatus(
    @CurrentUserId() userId: string,
    @Param('gameId') gameId: string,
  ): Promise<DeleteGameStatusResponseDto> {
    return this.listsService.deleteStatus(userId, gameId);
  }
}
