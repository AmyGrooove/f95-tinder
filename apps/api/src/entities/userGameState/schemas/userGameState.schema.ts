import type { UserGameStatus } from '@f95/contracts';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type UserGameStateDocument = HydratedDocument<UserGameState>;

@Schema({
  collection: 'userGameStates',
  timestamps: true,
})
export class UserGameState {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  userId!: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Game',
    required: true,
  })
  gameId!: string;

  @Prop({
    type: String,
    enum: ['bookmark', 'trash', 'played'],
    required: true,
  })
  status!: UserGameStatus;

  @Prop({ required: true, min: 1 })
  version!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export const UserGameStateSchema =
  SchemaFactory.createForClass(UserGameState);

UserGameStateSchema.index({ userId: 1, gameId: 1 }, { unique: true });
UserGameStateSchema.index({
  userId: 1,
  status: 1,
  updatedAt: -1,
  gameId: -1,
});
