import type { MongoEntity } from "@entities/shared/MongoEntity"

type TCreateEntity<
  TEntity,
  TOptionalKeys extends Exclude<keyof TEntity, keyof MongoEntity> = never,
  TOverrides extends Partial<
    Record<Exclude<keyof TEntity, keyof MongoEntity>, unknown>
  > = Record<never, never>,
> = Omit<TEntity, keyof MongoEntity | TOptionalKeys | keyof TOverrides> &
  Partial<Pick<TEntity, Exclude<TOptionalKeys, keyof TOverrides>>> &
  TOverrides

export type { TCreateEntity }
