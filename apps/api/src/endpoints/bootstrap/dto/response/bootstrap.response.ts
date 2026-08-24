import { ApiProperty, ApiSchema } from "@nestjs/swagger"

import { AuthUserDto } from "../../../auth/dto/response/auth-session.response"
import {
  CreatorResponseDto,
  PrefixResponseDto,
  TagResponseDto,
} from "../../../games/dto/response/game-list.response"
import { LibraryInfoResponseDto } from "../../../library/dto/response/library-info.response"

@ApiSchema({ name: "BootstrapResponse" })
class BootstrapResponseDto {
  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto

  @ApiProperty({ type: LibraryInfoResponseDto })
  libraryInfo!: LibraryInfoResponseDto

  @ApiProperty({ type: [TagResponseDto] })
  tags!: TagResponseDto[]

  @ApiProperty({ type: [PrefixResponseDto] })
  prefixes!: PrefixResponseDto[]

  @ApiProperty({ type: [CreatorResponseDto] })
  creators!: CreatorResponseDto[]

  @ApiProperty({ type: Object })
  catalogSyncStatus!: unknown
}

export { BootstrapResponseDto }
