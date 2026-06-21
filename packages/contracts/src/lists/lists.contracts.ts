import type { IsoDateTime } from '../common/error.contracts.js';
import type { GameDto, UserGameStatus } from '../game/game.contracts.js';

export const DEFAULT_LIST_PAGE_SIZE = 20 as const;

export interface ListQuery {
  cursor?: string;
  limit?: number;
}

export interface GameListItemDto {
  game: GameDto;
  status: UserGameStatus;
  updatedAt: IsoDateTime;
}

export interface GameListResponse {
  items: GameListItemDto[];
  nextCursor: string | null;
}

export interface UpdateGameStatusRequest {
  status: UserGameStatus;
}

export interface UpdateGameStatusResponse {
  gameId: string;
  status: UserGameStatus;
  updatedAt: IsoDateTime;
}

export interface DeleteGameStatusResponse {
  gameId: string;
  deleted: true;
}
