import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"

import { MongoEntity } from "@infrastructure/database/types/MongoEntity"

import { ESiteStatsKey } from "./ESiteStatsKey"

@Schema({ collection: "SiteStats", discriminatorKey: "key" })
class SiteStats extends MongoEntity {
  @Prop({ type: String, required: true, enum: Object.values(ESiteStatsKey) })
  key: ESiteStatsKey
}

const SiteStatsSchema = SchemaFactory.createForClass(SiteStats)

SiteStatsSchema.index({ key: 1 }, { name: "siteStatsKeyUnique", unique: true })

export { SiteStats, SiteStatsSchema }
