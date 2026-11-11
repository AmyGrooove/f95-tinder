import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from scipy.sparse import csr_matrix

from settings import ITEM_TYPES, USER_ITEM_STATUSES


@dataclass(frozen=True)
class CatalogItem:
    id: str
    type: str
    title: str


@dataclass(frozen=True)
class TrainingDataset:
    items: tuple[CatalogItem, ...]
    user_ids: tuple[str, ...]
    usernames: dict[str, str]
    matrix: csr_matrix
    blocked: dict[str, set[str]]
    interaction_count: int


def index_records(records: list[dict], label: str) -> dict[str, dict]:
    if not isinstance(records, list):
        raise ValueError(f"{label}: ожидался массив записей")

    indexed = {}
    for record in records:
        if not isinstance(record, dict):
            raise ValueError(f"{label}: ожидался объект записи")
        record_id = record.get("_id")
        if not isinstance(record_id, str) or not record_id:
            raise ValueError(f"{label}: у записи отсутствует строковый _id")
        if record_id in indexed:
            raise ValueError(f"{label}: повторяющийся _id {record_id}")
        indexed[record_id] = record

    return indexed


def load_dataset(catalog_path: Path, interactions_path: Path) -> TrainingDataset:
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    interactions = json.loads(interactions_path.read_text(encoding="utf-8"))
    if not isinstance(catalog, dict):
        raise ValueError("catalog: ожидался объект каталога")
    items = index_records(catalog["items"], "items")
    users = index_records(catalog["users"], "users")
    if not isinstance(interactions, list):
        raise ValueError("interactions: ожидался массив записей")

    catalog_items = {}
    for item_id, item in items.items():
        if item.get("type") not in ITEM_TYPES:
            raise ValueError(f"items: неизвестный тип произведения {item_id}")
        title = item.get("title")
        if not isinstance(title, dict):
            raise ValueError(f"items: title должен быть объектом у {item_id}")
        translations = (title.get("ru"), title.get("en"))
        if any(
            value is not None and not isinstance(value, str)
            for value in translations
        ):
            raise ValueError(
                f"items: переводы title должны быть строками или null у {item_id}"
            )
        display_titles = [
            value.strip() for value in translations if value and value.strip()
        ]
        if not display_titles:
            raise ValueError(f"items: требуется непустое название у {item_id}")
        catalog_items[item_id] = CatalogItem(
            id=item_id, type=item["type"], title=display_titles[0]
        )

    usernames = {}
    for user_id, user in users.items():
        username = user["username"]
        if not isinstance(username, str) or not username or username in usernames:
            raise ValueError("users: username должен быть непустым и уникальным")
        usernames[username] = user_id

    seen = set()
    positives = set()
    blocked = {}
    for row in interactions:
        if not isinstance(row, dict):
            raise ValueError("interactions: ожидался объект записи")
        user_id, item_id = row["user"], row["item"]
        if user_id not in users or item_id not in items:
            raise ValueError("Взаимодействие ссылается на неизвестного user или item")
        pair = (user_id, item_id)
        if pair in seen:
            raise ValueError(f"Повторяющаяся пара user/item: {pair}")
        seen.add(pair)

        if row["status"] not in USER_ITEM_STATUSES:
            raise ValueError(f"Неизвестный статус взаимодействия user/item: {pair}")
        rating, favorite = row["rating"], row["isFavorite"]
        if rating is not None and (
            type(rating) not in (int, float)
            or not 1 <= rating <= 10
            or rating % 1 != 0
        ):
            raise ValueError("rating должен быть целым числом от 1 до 10 или null")
        if type(favorite) is not bool:
            raise ValueError("isFavorite должен быть boolean")
        if row["status"] == "blocked":
            blocked.setdefault(user_id, set()).add(item_id)

        is_positive = (rating is not None and rating >= 8) or (
            favorite and (rating is None or rating >= 5)
        )
        if (
            row["status"] != "skipped"
            and items[item_id].get("deletedAt") is None
            and is_positive
        ):
            positives.add(pair)

    if not positives:
        raise ValueError("Для обучения нет положительных взаимодействий")

    user_ids = tuple(sorted(users))
    item_ids = tuple(sorted({item_id for _, item_id in positives}))
    user_indices = {user_id: index for index, user_id in enumerate(user_ids)}
    item_indices = {item_id: index for index, item_id in enumerate(item_ids)}
    pairs = sorted(positives)
    matrix = csr_matrix(
        (
            np.ones(len(pairs), dtype=np.float32),
            (
                [user_indices[user_id] for user_id, _ in pairs],
                [item_indices[item_id] for _, item_id in pairs],
            ),
        ),
        shape=(len(user_ids), len(item_ids)),
    )
    model_items = tuple(catalog_items[item_id] for item_id in item_ids)

    return TrainingDataset(
        items=model_items,
        user_ids=user_ids,
        usernames=usernames,
        matrix=matrix,
        blocked=blocked,
        interaction_count=len(interactions),
    )
