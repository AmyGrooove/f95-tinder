import type { IsoDateTime } from '../common/error.contracts.js';
import type { GameDto, UserGameStatus } from '../game/game.contracts.js';

export const SWIPE_QUEUE_SIZE = 20 as const;

export interface SwipeQueueResponse {
  items: GameDto[];
}

export interface CreateDecisionRequest {
  gameId: string;
  status: UserGameStatus;
}

export interface DecisionResponse {
  gameId: string;
  status: UserGameStatus;
  updatedAt: IsoDateTime;
}

export interface UndoResponse {
  game: GameDto;
  status: UserGameStatus | null;
  updatedAt: IsoDateTime;
}
