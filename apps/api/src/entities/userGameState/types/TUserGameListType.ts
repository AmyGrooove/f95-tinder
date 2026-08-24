type TUserGameListType = "favorite" | "trash" | "played"

const USER_GAME_LIST_TYPES = ["favorite", "trash", "played"] as const

export { USER_GAME_LIST_TYPES }
export type { TUserGameListType }
