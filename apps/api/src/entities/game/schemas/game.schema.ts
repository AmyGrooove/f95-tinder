import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type GameDocument = HydratedDocument<Game>;

@Schema({
  collection: 'games',
  timestamps: true,
})
export class Game {
  @Prop({ required: true, unique: true })
  f95ThreadId!: number;

  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ required: true, default: '' })
  creator!: string;

  @Prop({ required: true, default: '' })
  version!: string;

  @Prop({ required: true, default: 0, min: 0 })
  views!: number;

  @Prop({ required: true, default: 0, min: 0 })
  likes!: number;

  @Prop({ required: true, default: 0, min: 0 })
  rating!: number;

  @Prop({ type: [Number], required: true, default: [] })
  tagIds!: number[];

  @Prop({ type: [Number], required: true, default: [] })
  prefixIds!: number[];

  @Prop({ required: true, default: '' })
  coverUrl!: string;

  @Prop({ type: [String], required: true, default: [] })
  screenshotUrls!: string[];

  @Prop({ type: Date, default: null })
  publishedAt!: Date | null;

  @Prop({ type: Date, required: true })
  sourceUpdatedAt!: Date;

  @Prop({ type: Date, required: true })
  importedAt!: Date;
}

export const GameSchema = SchemaFactory.createForClass(Game);

GameSchema.index({ views: -1, _id: 1 });
GameSchema.index({ sourceUpdatedAt: -1 });
GameSchema.index({ tagIds: 1 });
GameSchema.index({ prefixIds: 1 });
