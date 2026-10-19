import type { JobContext } from "@infrastructure/jobs/types/JobContext"

interface ISourceDataStoragePathProps {
  sourceKey: string
  scope: string
  context: Pick<JobContext, "id" | "attempt">
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
