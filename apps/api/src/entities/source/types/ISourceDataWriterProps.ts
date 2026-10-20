import type { IJobContext } from "@infrastructure/jobs/types/IJobContext"

interface ISourceDataStoragePathProps {
  sourceKey: string
  scope: string
  context: Pick<IJobContext, "id" | "attempt">
}

interface ISourceDataPageProps {
  storagePath: string
  section: string
  pageNumber: number
  body: Buffer
}

interface ISourceDataManifestProps {
  storagePath: string
  manifest: object
}

export type {
  ISourceDataStoragePathProps,
  ISourceDataPageProps,
  ISourceDataManifestProps,
}
