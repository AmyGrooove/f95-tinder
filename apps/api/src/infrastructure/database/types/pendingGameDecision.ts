import type { UserGameStatus } from '@f95/contracts';

export type PendingGameDecision =
  | {
      operation: 'set';
      gameId: string;
      status: UserGameStatus;
      updatedAt: string;
      version: number;
    }
  | {
      operation: 'delete';
      gameId: string;
      updatedAt: string;
      version: number;
    };

export type GameDecisionOperation =
  | { operation: 'set'; status: UserGameStatus }
  | { operation: 'delete' };

export interface GameDecisionUndoSnapshot {
  gameId: string;
  previous: PendingGameDecision | null;
  decisionVersion: number;
}
