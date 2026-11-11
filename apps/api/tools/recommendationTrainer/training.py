from dataclasses import dataclass

import numpy as np
from implicit.cpu.als import AlternatingLeastSquares
from scipy.sparse import csr_matrix
from threadpoolctl import threadpool_limits

from dataset import TrainingDataset
from settings import ALS_PARAMETERS, CF_NEIGHBORS, CF_SHRINK


@dataclass(frozen=True)
class TrainedModels:
    neighbors: csr_matrix
    als: AlternatingLeastSquares
    popularity: np.ndarray


def train_item_cf(matrix: csr_matrix, popularity: np.ndarray) -> csr_matrix:
    item_users = matrix.T.tocsr()
    indices, values, offsets = [], [], [0]

    for item_index in range(matrix.shape[1]):
        cooccurrences = (item_users[item_index] @ matrix).tocsr()
        other_indices = cooccurrences.indices
        counts = cooccurrences.data
        keep = other_indices != item_index
        other_indices, counts = other_indices[keep], counts[keep]
        similarities = (
            counts
            / np.sqrt(popularity[item_index] * popularity[other_indices])
            * counts
            / (counts + CF_SHRINK)
        )
        order = np.lexsort(
            (other_indices, -popularity[other_indices], -similarities)
        )[:CF_NEIGHBORS]
        indices.extend(other_indices[order])
        values.extend(similarities[order])
        offsets.append(len(indices))

    return csr_matrix(
        (np.array(values, dtype=np.float32), indices, offsets),
        shape=(matrix.shape[1], matrix.shape[1]),
    )


def train_models(dataset: TrainingDataset) -> TrainedModels:
    popularity = np.asarray(dataset.matrix.sum(axis=0)).ravel()
    with threadpool_limits(limits=1):
        neighbors = train_item_cf(dataset.matrix, popularity)
        als = AlternatingLeastSquares(**ALS_PARAMETERS)
        als.fit(dataset.matrix, show_progress=False)

    if not np.isfinite(als.item_factors).all():
        raise ValueError("ALS вернул нечисловые факторы")

    return TrainedModels(neighbors=neighbors, als=als, popularity=popularity)


def read_scores(
    dataset: TrainingDataset, models: TrainedModels, user_index: int
) -> dict[str, np.ndarray]:
    history = dataset.matrix[user_index]
    with threadpool_limits(limits=1):
        user_factor = models.als.recalculate_user(user_index, history)
        scores = {
            "itemCF": (history @ models.neighbors).toarray().ravel(),
            "als": models.als.item_factors @ user_factor,
        }

    if not all(np.isfinite(values).all() for values in scores.values()):
        raise ValueError("Модель вернула нечисловые scores")

    return scores


def rank_candidates(
    dataset: TrainingDataset,
    models: TrainedModels,
    scores: np.ndarray,
    user_index: int,
    item_type: str,
    limit: int,
) -> list[dict]:
    positive_indices = set(dataset.matrix[user_index].indices)
    blocked_ids = dataset.blocked.get(dataset.user_ids[user_index], set())
    eligible = np.array(
        [
            index
            for index, item in enumerate(dataset.items)
            if item.type == item_type
            and index not in positive_indices
            and item.id not in blocked_ids
        ],
        dtype=np.int32,
    )
    order = np.lexsort((eligible, -models.popularity[eligible], -scores[eligible]))

    return [
        {
            "itemId": dataset.items[index].id,
            "title": dataset.items[index].title,
            "score": float(scores[index]),
        }
        for index in eligible[order[:limit]]
    ]
