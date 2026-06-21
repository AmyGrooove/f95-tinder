import type {
  CreateDecisionRequest,
  UserGameStatus,
} from '@f95/contracts';
import { IsIn, IsMongoId } from 'class-validator';

export class CreateDecisionBodyDto implements CreateDecisionRequest {
  @IsMongoId()
  gameId!: string;

  @IsIn(['bookmark', 'trash', 'played'])
  status!: UserGameStatus;
}
