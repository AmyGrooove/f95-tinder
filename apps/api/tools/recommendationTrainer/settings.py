MIN_POSITIVE_INTERACTIONS = 5
CF_NEIGHBORS = 100
CF_SHRINK = 10

ALS_PARAMETERS = {
    "factors": 32,
    "regularization": 0.05,
    "alpha": 20,
    "iterations": 20,
    "num_threads": 1,
    "random_state": 17,
}

ITEM_TYPES = (
    "movie",
    "series",
    "animatedMovie",
    "animatedSeries",
    "animeSeries",
    "animeMovie",
    "game",
)

USER_ITEM_STATUSES = (
    "planned",
    "inProgress",
    "onHold",
    "completed",
    "dropped",
    "skipped",
    "blocked",
)
