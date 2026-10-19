import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"

import { JOB_STATES } from "@infrastructure/jobs/static/JOB_STATES"
import type { TJobState } from "@infrastructure/jobs/types/TJobState"

class KodikMovieCollectionResponseDto {
  @ApiProperty()
  id: string

  @ApiProperty({ enum: JOB_STATES })
  state: TJobState

  @ApiProperty({ minimum: 0, maximum: 100 })
  progress: number

  @ApiProperty({ minimum: 0 })
  attempt: number

  @ApiProperty()
  storagePath: string

  @ApiProperty({ type: Date })
  createdAt: Date

  @ApiPropertyOptional()
  status?: string

  @ApiPropertyOptional()
  failedReason?: string

  @ApiPropertyOptional({ type: Date })
  startedAt?: Date

  @ApiPropertyOptional({ type: Date })
  finishedAt?: Date
}

export { KodikMovieCollectionResponseDto }
