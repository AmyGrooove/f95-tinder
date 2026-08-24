const USER_STATUSES = ["active", "blocked"] as const

type TUserStatus = (typeof USER_STATUSES)[number]

export { USER_STATUSES }
export type { TUserStatus }
