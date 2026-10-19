const KODIK_SETTINGS = {
  clientName: "kodik",
  apiUrl: "https://kodik-api.com",
  requestTimeoutMs: 30_000,
  searchFields: [
    "title",
    "title_orig",
    "id",
    "player_link",
    "kinopoisk_id",
    "imdb_id",
    "mdl_id",
    "shikimori_id",
    "worldart_animation_id",
    "worldart_cinema_id",
    "worldart_link",
  ],
} as const

export { KODIK_SETTINGS }
