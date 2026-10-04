import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { isArray } from "@shared/functions/checks/isArray"
import { isNumber } from "@shared/functions/checks/isNumber"

@Schema({
  _id: false,
  id: false,
  timestamps: false,
  versionKey: false,
  strict: true,
})
class Embedding {
  @Prop({
    type: [Number],
    required: true,
    default: undefined,
    validate: (value: unknown) =>
      isArray(value) &&
      value.every((entry) => isNumber(entry) && Number.isFinite(entry)),
  })
  vector: number[]

  @Prop({ type: String, required: true })
  model: string

  @Prop({ type: Date, required: true })
  updatedAt: Date
}

const EmbeddingSchema = SchemaFactory.createForClass(Embedding)

export { Embedding, EmbeddingSchema }
