import type { MongoEntity } from "./MongoEntity"

type TGeneratedEntityKey<TEntity> = TEntity extends MongoEntity
  ? keyof MongoEntity
  : never

type TCreateEntity<
  TEntity,
  TOptionalKeys extends Exclude<keyof TEntity, TGeneratedEntityKey<TEntity>> =
    never,
  TOverrides extends Partial<
    Record<Exclude<keyof TEntity, TGeneratedEntityKey<TEntity>>, unknown>
  > = Record<never, never>,
> = Omit<
  TEntity,
  TGeneratedEntityKey<TEntity> | TOptionalKeys | keyof TOverrides
> &
  Partial<Pick<TEntity, Exclude<TOptionalKeys, keyof TOverrides>>> &
  TOverrides

export type { TCreateEntity }
