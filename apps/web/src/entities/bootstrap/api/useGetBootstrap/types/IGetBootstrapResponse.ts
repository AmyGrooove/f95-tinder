import type { ICatalogSyncStatus } from '@entities/sync/types/ICatalogSyncStatus'

interface IGetBootstrapResponse {
  catalogSyncStatus: ICatalogSyncStatus
  creators: Array<{ id: string; name: string; slug: string }>
  libraryInfo: {
    favorites: number
    played: number
    total: number
    trash: number
  }
  prefixes: Array<{
    f95PrefixId: number
    group: string
    id: string
    name: string
    slug: string
  }>
  tags: Array<{ f95TagId: number; id: string; name: string; slug: string }>
  user: {
    displayName: string
    email: string
    id: string
    lastLoginAt: string | null
    role: 'admin' | 'user'
    status: 'active' | 'blocked'
  }
}

export type { IGetBootstrapResponse }
