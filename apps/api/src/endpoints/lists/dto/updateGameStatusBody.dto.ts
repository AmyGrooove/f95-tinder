import type {
  DeleteGameStatusResponse,
  UpdateGameStatusRequest,
  UpdateGameStatusResponse,
  UserGameStatus,
} from '@f95/contracts';
import { IsIn } from 'class-validator';

export class UpdateGameStatusBodyDto
  implements UpdateGameStatusRequest
{
  @IsIn(['bookmark', 'trash', 'played'])
  status!: UserGameStatus;
}

export class UpdateGameStatusResponseDto
  implements UpdateGameStatusResponse
{
  gameId!: string;
  status!: UserGameStatus;
  updatedAt!: string;
}

export class DeleteGameStatusResponseDto
  implements DeleteGameStatusResponse
{
  gameId!: string;
  deleted!: true;
}
