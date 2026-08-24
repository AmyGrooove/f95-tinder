import { Transform, Type } from "class-transformer"
import {
  IsArray,
  IsIn,
  IsNumber,
  IsString,
  ValidateNested,
} from "class-validator"

import type { TF95LatestThreadItem } from "./TF95LatestThreadItem"

class F95LatestThreadItemDto implements TF95LatestThreadItem {
  @IsNumber()
  thread_id!: number

  @IsString()
  title!: string

  @IsString()
  creator!: string

  @Transform(({ value }) => {
    return typeof value === "number" ? String(value) : value
  })
  @IsString()
  version!: string

  @IsArray()
  @IsNumber({}, { each: true })
  prefixes!: number[]

  @IsArray()
  @IsNumber({}, { each: true })
  tags!: number[]

  @IsString()
  cover!: string

  @IsArray()
  @IsString({ each: true })
  screens!: string[]

  @IsString()
  date!: string

  @IsNumber()
  ts!: number
}

class F95LatestPaginationDto {
  @IsNumber()
  page!: number

  @IsNumber()
  total!: number
}

class F95LatestMessageDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => F95LatestThreadItemDto)
  data!: F95LatestThreadItemDto[]

  @ValidateNested()
  @Type(() => F95LatestPaginationDto)
  pagination!: F95LatestPaginationDto

  @IsNumber()
  count!: number
}

class F95LatestResponseDto {
  @IsIn(["ok", "error"])
  status!: "ok" | "error"

  @ValidateNested()
  @Type(() => F95LatestMessageDto)
  msg!: F95LatestMessageDto
}

type TF95LatestResponse = {
  status: "ok" | "error"
  msg: {
    data: TF95LatestThreadItem[]
    pagination: {
      page: number
      total: number
    }
    count: number
  }
}

export {
  F95LatestMessageDto,
  F95LatestPaginationDto,
  F95LatestResponseDto,
  F95LatestThreadItemDto,
  type TF95LatestResponse,
}
