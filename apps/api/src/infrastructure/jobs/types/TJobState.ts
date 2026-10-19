import type { JOB_STATES } from "../static/JOB_STATES"

type TJobState = (typeof JOB_STATES)[number]

export type { TJobState }
