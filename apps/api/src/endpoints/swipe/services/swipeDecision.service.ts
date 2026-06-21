import type { UserGameStatus } from '@f95/contracts';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { GameRepository } from '../../../entities/game/services/game.repository';
import { GameDecisionWriteBehindService } from '../../../infrastructure/database/services/gameDecisionWriteBehind.service';
import { toGameDto } from '../../../shared/functions/game/toGameDto';
import {
  DecisionResponseDto,
  UndoResponseDto,
} from '../dto/undoResponse.dto';

@Injectable()
export class SwipeDecisionService {
  constructor(
    private readonly gameRepository: GameRepository,
    private readonly writeBehindService: GameDecisionWriteBehindService,
  ) {}

  async createDecision(
    userId: string,
    gameId: string,
    status: UserGameStatus,
  ): Promise<DecisionResponseDto> {
    const game = await this.gameRepository.findById(gameId);

    if (!game) {
      throw this.gameNotFound();
    }

    const decision = await this.writeBehindService.recordDecision(
      userId,
      gameId,
      { operation: 'set', status },
    );

    return {
      gameId: decision.gameId,
      status,
      updatedAt: decision.updatedAt,
    };
  }

  async undo(userId: string): Promise<UndoResponseDto> {
    const result = await this.writeBehindService.undo(userId);

    if (result.kind === 'unavailable') {
      throw new NotFoundException({
        statusCode: 404,
        code: 'undo_not_available',
        message: 'There is no decision available to undo',
      });
    }

    if (result.kind === 'conflict') {
      throw new ConflictException({
        statusCode: 409,
        code: 'undo_conflict',
        message: 'A newer decision prevents this undo',
      });
    }

    const { decision } = result;
    const game = await this.gameRepository.findById(decision.gameId);

    if (!game) {
      throw this.gameNotFound();
    }

    return {
      game: toGameDto(game),
      status:
        decision.operation === 'set'
          ? decision.status
          : null,
      updatedAt: decision.updatedAt,
    };
  }

  private gameNotFound(): NotFoundException {
    return new NotFoundException({
      statusCode: 404,
      code: 'game_not_found',
      message: 'The requested game does not exist',
    });
  }
}
