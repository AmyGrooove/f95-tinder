/* eslint-disable @typescript-eslint/naming-convention -- Field names follow the external Kodik API contract. */

type TKodikFilterValue = string | number | readonly (string | number)[]

interface IKodikCommonParameters {
  limit?: number
  types?: TKodikFilterValue
  year?: TKodikFilterValue
  translation_id?: TKodikFilterValue
  translation_type?: "voice" | "subtitles"
  block_translations?: TKodikFilterValue
  has_field?: TKodikFilterValue
  has_field_and?: TKodikFilterValue
  camrip?: boolean
  lgbt?: boolean
  not_blocked_in?: TKodikFilterValue
  not_blocked_for_me?: boolean
  with_seasons?: boolean
  with_episodes?: boolean
  with_episodes_data?: boolean
  with_page_links?: boolean
  with_material_data?: boolean
  countries?: TKodikFilterValue
  countries_and?: TKodikFilterValue
  genres?: TKodikFilterValue
  genres_and?: TKodikFilterValue
  anime_genres?: TKodikFilterValue
  anime_genres_and?: TKodikFilterValue
  drama_genres?: TKodikFilterValue
  drama_genres_and?: TKodikFilterValue
  all_genres?: TKodikFilterValue
  all_genres_and?: TKodikFilterValue
  duration?: TKodikFilterValue
  kinopoisk_rating?: TKodikFilterValue
  imdb_rating?: TKodikFilterValue
  shikimori_rating?: TKodikFilterValue
  mydramalist_rating?: TKodikFilterValue
  rating_mpaa?: TKodikFilterValue
  minimal_age?: TKodikFilterValue
  actors?: TKodikFilterValue
  actors_and?: TKodikFilterValue
  directors?: TKodikFilterValue
  directors_and?: TKodikFilterValue
  producers?: TKodikFilterValue
  producers_and?: TKodikFilterValue
  writers?: TKodikFilterValue
  writers_and?: TKodikFilterValue
  composers?: TKodikFilterValue
  composers_and?: TKodikFilterValue
  editors?: TKodikFilterValue
  editors_and?: TKodikFilterValue
  designers?: TKodikFilterValue
  designers_and?: TKodikFilterValue
  operators?: TKodikFilterValue
  operators_and?: TKodikFilterValue
  anime_kind?: TKodikFilterValue
  mydramalist_tags?: TKodikFilterValue
  mydramalist_tags_and?: TKodikFilterValue
  anime_status?: TKodikFilterValue
  drama_status?: TKodikFilterValue
  all_status?: TKodikFilterValue
  anime_studios?: TKodikFilterValue
  anime_studios_and?: TKodikFilterValue
  anime_licensed_by?: TKodikFilterValue
  anime_licensed_by_and?: TKodikFilterValue
}

interface IKodikListParameters extends IKodikCommonParameters {
  sort?:
    | "year"
    | "created_at"
    | "updated_at"
    | "kinopoisk_rating"
    | "imdb_rating"
    | "shikimori_rating"
  order?: "asc" | "desc"
}

interface IKodikSearchParameters extends IKodikCommonParameters {
  title?: string
  title_orig?: string
  strict?: boolean
  full_match?: boolean
  id?: string
  player_link?: string
  kinopoisk_id?: string | number
  imdb_id?: string
  mdl_id?: string | number
  shikimori_id?: string | number
  worldart_animation_id?: string | number
  worldart_cinema_id?: string | number
  worldart_link?: string
  prioritize_translations?: TKodikFilterValue
  unprioritize_translations?: TKodikFilterValue
  prioritize_translation_type?: "voice" | "subtitles"
  season?: number
  episode?: number
}

export type {
  IKodikCommonParameters,
  IKodikListParameters,
  IKodikSearchParameters,
  TKodikFilterValue,
}
