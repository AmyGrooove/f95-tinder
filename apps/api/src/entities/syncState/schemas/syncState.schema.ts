import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import type { CatalogSyncPhase } from '@f95/contracts';

export type SyncStateDocument = HydratedDocument<SyncState>;

@Schema({
  collection: 'syncStates',
  timestamps: true,
})
export class SyncState {
  @Prop({ required: true, unique: true })
  source!: string;

  @Prop({ required: true, default: 'idle' })
  phase!: CatalogSyncPhase;

  @Prop({ required: true, default: 0, min: 0 })
  currentPage!: number;

  @Prop({ type: Number, default: null, min: 0 })
  totalPages!: number | null;

  @Prop({ required: true, default: 0, min: 0 })
  processedGames!: number;

  @Prop({ required: true, default: 0, min: 0 })
  checkpointPage!: number;

  @Prop({ required: true, default: 0, min: 0 })
  retryAttempt!: number;

  @Prop({ type: Date, default: null })
  watermarkSourceTimestamp!: Date | null;

  @Prop({ type: Date, default: null })
  startedAt!: Date | null;

  @Prop({ type: Date, default: null })
  lastSuccessfulSyncAt!: Date | null;

  @Prop({ type: Date, default: null })
  nextRetryAt!: Date | null;

  @Prop({ type: String, default: null })
  lastError!: string | null;
}

export const SyncStateSchema = SchemaFactory.createForClass(SyncState);
