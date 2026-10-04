import type { TCreateEntity } from "@entities/shared/TCreateEntity"
import { MongoEntity } from "@entities/shared/MongoEntity"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import type { LanguageText } from "@entities/shared/schemas/languageText.schema"
import { LanguageTextSchema } from "@entities/shared/schemas/languageText.schema"

@Schema({
  collection: "itemRelationRoles",
  timestamps: true,
  versionKey: false,
  strict: true,
})
class ItemRelationRole extends MongoEntity {
  @Prop({ type: String, required: true })
  key: string

  @Prop({ type: String, required: true })
  group: string

  @Prop({ type: LanguageTextSchema, required: true })
  name: LanguageText

  @Prop({ type: LanguageTextSchema, default: null })
  description: LanguageText | null
}

type TCreateItemRelationRole = TCreateEntity<ItemRelationRole, "description">

const ItemRelationRoleSchema = SchemaFactory.createForClass(ItemRelationRole)

ItemRelationRoleSchema.index(
  { key: 1 },
  { name: "relation_role_key", unique: true },
)

export { ItemRelationRole, ItemRelationRoleSchema }
export type { TCreateItemRelationRole }
