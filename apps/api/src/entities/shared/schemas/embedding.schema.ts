import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { isArray } from "@shared/functions/checks/isArray"
import { isFiniteNumber } from "@shared/functions/checks/isFiniteNumber"

@Schema({
  _id: false,
  id: false,
  timestamps: false,
})
class Embedding {
  @Prop({
    type: [Number],
    required: true,
    default: undefined,
    validate: (value: unknown) => isArray(value) && value.every(isFiniteNumber),
  })
  vector: number[]

  @Prop({ type: Date, required: true })
  updatedAt: Date
}

const EmbeddingSchema = SchemaFactory.createForClass(Embedding)

export { Embedding, EmbeddingSchema }
