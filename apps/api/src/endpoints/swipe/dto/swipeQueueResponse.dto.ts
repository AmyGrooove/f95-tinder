import type { GameDto, SwipeQueueResponse } from '@f95/contracts';

export class SwipeQueueResponseDto implements SwipeQueueResponse {
  items!: GameDto[];
}
