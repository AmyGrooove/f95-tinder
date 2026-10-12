import { EFeatureUnit } from "@entities/shared/schemas/EFeatureUnit"
import { EFeatureGroup } from "./EFeatureGroup"
import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { MongoEntity } from "@infrastructure/database/types/MongoEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import type { LanguageText } from "@entities/shared/schemas/languageText.schema"
import { LanguageTextSchema } from "@entities/shared/schemas/languageText.schema"
import { EFeatureValueType } from "./EFeatureValueType"

@Schema({ collection: "Feature" })
class Feature extends MongoEntity {
  @Prop({ type: String, required: true })
  key: string

  @Prop({ type: String, enum: Object.values(EFeatureGroup), required: true })
  group: EFeatureGroup

  @Prop({ type: LanguageTextSchema, required: true })
  name: LanguageText

  @Prop({ type: LanguageTextSchema, default: null })
  description: LanguageText | null

  @Prop({
    type: String,
    enum: Object.values(EFeatureValueType),
    required: true,
  })
  valueType: EFeatureValueType

  @Prop({ type: String, enum: Object.values(EFeatureUnit), required: true })
  unit: EFeatureUnit
}

type TCreateFeature = TCreateEntity<Feature, "description">

const FeatureSchema = SchemaFactory.createForClass(Feature)

FeatureSchema.index({ key: 1 }, { name: "featureKey", unique: true })

export { Feature, FeatureSchema }
export type { TCreateFeature }
