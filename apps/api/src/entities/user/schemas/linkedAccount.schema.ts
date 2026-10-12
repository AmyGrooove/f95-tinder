import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { ELinkedAccountProvider } from "./ELinkedAccountProvider"

@Schema({
  _id: false,
  id: false,
  timestamps: false,
})
class LinkedAccount {
  @Prop({
    type: String,
    enum: Object.values(ELinkedAccountProvider),
    required: true,
  })
  provider: ELinkedAccountProvider

  @Prop({ type: String, required: true })
  externalId: string
}

const LinkedAccountSchema = SchemaFactory.createForClass(LinkedAccount)

export { LinkedAccount, LinkedAccountSchema }
