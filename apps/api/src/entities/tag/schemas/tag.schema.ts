import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TagDocument = HydratedDocument<Tag>;

@Schema({
  collection: 'tags',
  timestamps: true,
})
export class Tag {
  @Prop({ required: true, unique: true })
  f95TagId!: number;

  @Prop({ required: true, trim: true })
  name!: string;
}

export const TagSchema = SchemaFactory.createForClass(Tag);
