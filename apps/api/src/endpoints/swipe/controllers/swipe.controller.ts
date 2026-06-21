import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUserId } from '../../../infrastructure/security/decorators/CurrentUserId';
import { BearerTokenGuard } from '../../../infrastructure/security/guards/bearerToken.guard';
import { CreateDecisionBodyDto } from '../dto/createDecisionBody.dto';
import { SwipeQueueResponseDto } from '../dto/swipeQueueResponse.dto';
import {
  DecisionResponseDto,
  UndoResponseDto,
} from '../dto/undoResponse.dto';
import { SwipeDecisionService } from '../services/swipeDecision.service';
import { SwipeQueueService } from '../services/swipeQueue.service';

@Controller('swipe')
@UseGuards(BearerTokenGuard)
export class SwipeController {
  constructor(
    private readonly swipeQueueService: SwipeQueueService,
    private readonly swipeDecisionService: SwipeDecisionService,
  ) {}

  @Get('queue')
  getQueue(
    @CurrentUserId() userId: string,
  ): Promise<SwipeQueueResponseDto> {
    return this.swipeQueueService.getQueue(userId);
  }

  @Post('decisions')
  @HttpCode(HttpStatus.OK)
  createDecision(
    @CurrentUserId() userId: string,
    @Body() body: CreateDecisionBodyDto,
  ): Promise<DecisionResponseDto> {
    return this.swipeDecisionService.createDecision(
      userId,
      body.gameId,
      body.status,
    );
  }

  @Post('undo')
  @HttpCode(HttpStatus.OK)
  undo(
    @CurrentUserId() userId: string,
  ): Promise<UndoResponseDto> {
    return this.swipeDecisionService.undo(userId);
  }
}
