import type {
  DecisionResponse,
  GameDto,
  UndoResponse,
  UserGameStatus,
} from '@f95/contracts';

export class DecisionResponseDto implements DecisionResponse {
  gameId!: string;
  status!: UserGameStatus;
  updatedAt!: string;
}

export class UndoResponseDto implements UndoResponse {
  game!: GameDto;
  status!: UserGameStatus | null;
  updatedAt!: string;
}
