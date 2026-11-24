from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from tempfile import NamedTemporaryFile

import numpy as np
from bson import BSON, ObjectId
from bson.raw_bson import RawBSONDocument
from pymongo import MongoClient, WriteConcern

from dataset import TrainingDataset
from settings import CF_NEIGHBORS, CF_SHRINK
from training import TrainedModels


MODEL_FORMAT_VERSION = 1
MAX_BSON_SIZE = 16 * 1024 * 1024
MODEL_COLLECTION = "RecommendationModel"


@dataclass(frozen=True)
class ModelArtifact:
    id: ObjectId
    bson: bytes


def create_model_artifact(
    dataset: TrainingDataset, models: TrainedModels
) -> ModelArtifact:
    model_id = ObjectId()
    created_at = datetime.now(timezone.utc)
    neighbors = models.neighbors
    als = models.als
    document = {
        "_id": model_id,
        "formatVersion": MODEL_FORMAT_VERSION,
        "itemIds": [item.id for item in dataset.items],
        "itemCF": {
            "maxNeighbors": CF_NEIGHBORS,
            "shrink": CF_SHRINK,
            "offsets": np.asarray(neighbors.indptr, dtype="<i4").tobytes(),
            "indices": np.asarray(neighbors.indices, dtype="<i4").tobytes(),
            "weights": np.asarray(neighbors.data, dtype="<f4").tobytes(),
        },
        "als": {
            "factors": als.factors,
            "alpha": als.alpha,
            "regularization": als.regularization,
            "itemFactors": np.asarray(als.item_factors, dtype="<f4").tobytes(),
        },
        "popularity": np.asarray(models.popularity, dtype="<f4").tobytes(),
        "createdAt": created_at,
        "updatedAt": created_at,
    }
    payload = BSON.encode(document)
    if len(payload) > MAX_BSON_SIZE:
        raise ValueError(
            f"Модель занимает {len(payload)} байт и превышает лимит BSON в 16 МиБ"
        )
    return ModelArtifact(id=model_id, bson=payload)


def write_model_file(artifact: ModelArtifact, directory: Path) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    destination = directory / f"{artifact.id}.bson"
    temporary_path = None

    try:
        with NamedTemporaryFile(dir=directory, delete=False) as stream:
            temporary_path = Path(stream.name)
            stream.write(artifact.bson)
        temporary_path.replace(destination)
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)

    return destination


def save_model_to_mongo(artifact: ModelArtifact, mongo_url: str) -> None:
    with MongoClient(mongo_url, timeoutMS=15_000) as client:
        collection = client.get_default_database().get_collection(
            MODEL_COLLECTION, write_concern=WriteConcern(w="majority")
        )
        collection.insert_one(RawBSONDocument(artifact.bson))
