import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PrefixDocument = HydratedDocument<Prefix>;

@Schema({
  collection: 'prefixes',
  timestamps: true,
})
export class Prefix {
  @Prop({ required: true, unique: true })
  f95PrefixId!: number;

  @Prop({ required: true, trim: true })
  name!: string;
}

export const PrefixSchema = SchemaFactory.createForClass(Prefix);
