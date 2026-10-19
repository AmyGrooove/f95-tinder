import type { ItemFeature } from "../../../schemas/itemFeature.schema"

interface IMatchItemFeatureProps {
  featureId: ItemFeature["feature"]
  value: ItemFeature["value"]
}

export type { IMatchItemFeatureProps }
