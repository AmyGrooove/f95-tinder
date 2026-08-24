type TJobState =
  | "active"
  | "completed"
  | "delayed"
  | "failed"
  | "prioritized"
  | "unknown"
  | "waiting"
  | "waiting-children"

export type { TJobState }
