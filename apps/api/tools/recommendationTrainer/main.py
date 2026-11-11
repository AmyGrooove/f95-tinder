import argparse
import json
import os
import sys
from pathlib import Path

from pymongo.errors import PyMongoError

from dataset import load_dataset
from model_artifact import create_model_artifact, save_model_to_mongo, write_model_file
from settings import (
    ALS_PARAMETERS,
    CF_NEIGHBORS,
    CF_SHRINK,
    ITEM_TYPES,
    MIN_POSITIVE_INTERACTIONS,
)
from training import rank_candidates, read_scores, train_models


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    fixtures = Path(__file__).resolve().parents[2] / "fixtures" / "recommendations"
    parser = argparse.ArgumentParser(
        description="Обучение ItemCF/ALS и просмотр кандидатов"
    )
    parser.add_argument(
        "--user", help="ID или username пользователя для просмотра кандидатов"
    )
    parser.add_argument(
        "--type", choices=ITEM_TYPES, help="Тип кандидатов, по умолчанию все типы"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=10,
        help="Число кандидатов каждого типа и алгоритма",
    )
    parser.add_argument("--catalog", type=Path, default=fixtures / "catalog.json")
    parser.add_argument(
        "--interactions", type=Path, default=fixtures / "interactions.json"
    )
    parser.add_argument("--output", type=Path, help="Папка для BSON-файла модели")
    parser.add_argument(
        "--save-to-mongo", action="store_true", help="Сохранить модель в MongoDB из MONGO_URL"
    )
    args = parser.parse_args()
    if args.user is None and args.output is None and not args.save_to_mongo:
        parser.error("Укажите --user, --output или --save-to-mongo")
    if not 1 <= args.limit <= 500:
        parser.error("--limit должен быть от 1 до 500")
    mongo_url = os.environ.get("MONGO_URL", "").strip() if args.save_to_mongo else ""
    if args.save_to_mongo and not mongo_url:
        parser.error("Для --save-to-mongo задайте MONGO_URL с именем базы")

    dataset = load_dataset(args.catalog, args.interactions)
    user_index = None
    if args.user is not None:
        user_id = (
            args.user
            if args.user in dataset.user_ids
            else dataset.usernames.get(args.user)
        )
        if user_id is None:
            parser.error(f"Пользователь {args.user} отсутствует в каталоге")
        user_index = dataset.user_ids.index(user_id)

    models = train_models(dataset)
    result = {
        "training": {
            "users": len(dataset.user_ids),
            "items": len(dataset.items),
            "interactions": dataset.interaction_count,
            "positiveInteractions": dataset.matrix.nnz,
            "parameters": {
                "itemCF": {"neighbors": CF_NEIGHBORS, "shrink": CF_SHRINK},
                "als": ALS_PARAMETERS,
            },
        },
    }
    if user_index is not None:
        positive_count = dataset.matrix[user_index].nnz
        requires_fallback = positive_count < MIN_POSITIVE_INTERACTIONS
        candidates = {}

        if not requires_fallback:
            scores = read_scores(dataset, models, user_index)
            item_types = (args.type,) if args.type else ITEM_TYPES
            for item_type in item_types:
                candidates[item_type] = {
                    algorithm: rank_candidates(
                        dataset, models, values, user_index, item_type, args.limit
                    )
                    for algorithm, values in scores.items()
                }

        result.update(
            userId=dataset.user_ids[user_index],
            positiveCount=positive_count,
            requiresFallback=requires_fallback,
            stage="modelCandidatesBeforeApiFilters",
            candidates=candidates,
        )

    if args.output is not None or args.save_to_mongo:
        artifact = create_model_artifact(dataset, models)
        model = {"id": str(artifact.id), "sizeBytes": len(artifact.bson)}
        if args.output is not None:
            model["path"] = str(write_model_file(artifact, args.output))
        if args.save_to_mongo:
            save_model_to_mongo(artifact, mongo_url)
            model["savedToMongo"] = True
        result["model"] = model

    print(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False))


if __name__ == "__main__":
    try:
        main()
    except PyMongoError as error:
        print(f"Ошибка записи в MongoDB: {type(error).__name__}", file=sys.stderr)
        sys.exit(1)
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f"Ошибка trainer: {error}", file=sys.stderr)
        sys.exit(1)
