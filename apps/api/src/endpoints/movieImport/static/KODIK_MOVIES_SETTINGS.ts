const KODIK_MOVIES_SETTINGS = {
  sourceKey: "kodik",
  scope: "movies",
  importedMoviesLimit: 10,
  excludedGenres: ["мультфильм", "аниме"],
  parameters: {
    types: "foreign-movie,russian-movie",
    with_material_data: true,
    limit: 100,
  },
} as const

export { KODIK_MOVIES_SETTINGS }
