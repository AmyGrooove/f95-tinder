import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { isFiniteNumber } from "@shared/functions/checks/isFiniteNumber"

@Schema({ _id: false, id: false, timestamps: false })
class ItemGame {
  @Prop({ type: Number, min: Number.MIN_VALUE, validate: isFiniteNumber })
  mainStoryDuration?: number

  @Prop({ type: Number, min: Number.MIN_VALUE, validate: isFiniteNumber })
  fullCompletionDuration?: number
}

const ItemGameSchema = SchemaFactory.createForClass(ItemGame)

export { ItemGame, ItemGameSchema }
