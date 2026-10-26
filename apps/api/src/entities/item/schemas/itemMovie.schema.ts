import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { isFiniteNumber } from "@shared/functions/checks/isFiniteNumber"

@Schema({ _id: false, id: false, timestamps: false })
class ItemMovie {
  @Prop({ type: Number, min: Number.MIN_VALUE, validate: isFiniteNumber })
  duration?: number
}

const ItemMovieSchema = SchemaFactory.createForClass(ItemMovie)

export { ItemMovie, ItemMovieSchema }
