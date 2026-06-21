import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({
  collection: 'users',
  timestamps: true,
})
export class User {
  @Prop({ required: true, unique: true, select: false })
  tokenHash!: string;

  @Prop({ required: true, select: false })
  tokenEncrypted!: string;

  @Prop({ required: true, select: false })
  tokenEncryptionIv!: string;

  @Prop({ required: true, select: false })
  tokenEncryptionTag!: string;

  @Prop({ required: true, select: false })
  tokenEncryptionKeyVersion!: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
