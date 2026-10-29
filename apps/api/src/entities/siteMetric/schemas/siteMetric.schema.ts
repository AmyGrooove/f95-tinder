import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"

import { MongoEntity } from "@infrastructure/database/types/MongoEntity"

import { ESiteMetricKey } from "./ESiteMetricKey"

@Schema({ collection: "SiteMetric", discriminatorKey: "key" })
class SiteMetric extends MongoEntity {
  @Prop({ type: String, required: true, enum: Object.values(ESiteMetricKey) })
  key: ESiteMetricKey
}

const SiteMetricSchema = SchemaFactory.createForClass(SiteMetric)

SiteMetricSchema.index(
  { key: 1 },
  { name: "siteMetricKeyUnique", unique: true },
)

export { SiteMetric, SiteMetricSchema }
