import { EItemRelationRoleGroup } from "./EItemRelationRoleGroup"
import type { TCreateEntity } from "@infrastructure/database/types/TCreateEntity"
import { MongoEntity } from "@infrastructure/database/types/MongoEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import type { LanguageText } from "@entities/shared/schemas/languageText.schema"
import { LanguageTextSchema } from "@entities/shared/schemas/languageText.schema"

@Schema({ collection: "ItemRelationRole" })
class ItemRelationRole extends MongoEntity {
  @Prop({ type: String, required: true })
  key: string

  @Prop({
    type: String,
    enum: Object.values(EItemRelationRoleGroup),
    required: true,
  })
  group: EItemRelationRoleGroup

  @Prop({ type: LanguageTextSchema, required: true })
  name: LanguageText

  @Prop({ type: LanguageTextSchema, default: null })
  description: LanguageText | null
}

type TCreateItemRelationRole = TCreateEntity<ItemRelationRole, "description">

const ItemRelationRoleSchema = SchemaFactory.createForClass(ItemRelationRole)

ItemRelationRoleSchema.index(
  { key: 1 },
  { name: "itemRelationRoleKey", unique: true },
)

export { ItemRelationRole, ItemRelationRoleSchema }
export type { TCreateItemRelationRole }
