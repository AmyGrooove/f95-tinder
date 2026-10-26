import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { isFiniteNumber } from "@shared/functions/checks/isFiniteNumber"
import { isNil } from "@shared/functions/checks/isNil"

@Schema({ _id: false, id: false, timestamps: false })
class ItemSeries {
  @Prop({ type: Number, min: 1, validate: Number.isSafeInteger })
  episodeCount?: number

  @Prop({ type: Number, min: 0, validate: Number.isSafeInteger })
  releasedEpisodeCount?: number

  @Prop({ type: Number, min: Number.MIN_VALUE, validate: isFiniteNumber })
  episodeDuration?: number

  @Prop({ type: Date })
  nextEpisodeAt?: Date
}

const ItemSeriesSchema = SchemaFactory.createForClass(ItemSeries)

ItemSeriesSchema.pre("validate", function () {
  if (
    !isNil(this.episodeCount) &&
    !isNil(this.releasedEpisodeCount) &&
    this.releasedEpisodeCount > this.episodeCount
  ) {
    this.invalidate(
      "releasedEpisodeCount",
      "Released episode count must not exceed total episode count",
    )
  }
})

export { ItemSeries, ItemSeriesSchema }
