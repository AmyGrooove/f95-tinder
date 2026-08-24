const USER_ROLES = ["user", "admin"] as const

type TUserRole = (typeof USER_ROLES)[number]

export { USER_ROLES }
export type { TUserRole }
