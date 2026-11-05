import type { UserItem } from "@entities/userItem/schemas/userItem.schema"
import { getTestApplication } from "@app/__tests__/setup/setupIntegration"

const readSavedUserItem = async (
  filter: Partial<Pick<UserItem, "_id" | "item" | "user">>,
) => {
  const entry = await getTestApplication()
    .connection.collection<UserItem>("UserItem")
    .findOne(filter)
  if (entry === null) {
    throw new Error("Тестовая запись библиотеки не найдена")
  }

  return {
    id: entry._id.toHexString(),
    itemId: entry.item.toHexString(),
    status: entry.status,
    expiresAt: entry.expiresAt?.toISOString() ?? null,
    rating: entry.rating,
    isFavorite: entry.isFavorite,
    note: entry.note,
    attempts: entry.attempts.map(
      ({ id, isCompleted, progress, unit, startedAt, completedAt }) => ({
        id: id.toHexString(),
        isCompleted,
        progress,
        unit,
        startedAt: startedAt?.toISOString() ?? null,
        completedAt: completedAt?.toISOString() ?? null,
      }),
    ),
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  }
}

export { readSavedUserItem }
