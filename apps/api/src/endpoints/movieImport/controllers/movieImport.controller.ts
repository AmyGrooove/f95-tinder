import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common"
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger"

import { EUserRole } from "@entities/user/schemas/EUserRole"
import { Roles } from "@infrastructure/security/decorators/Roles"
import { AccessTokenGuard } from "@infrastructure/security/guards/accessToken.guard"
import { RolesGuard } from "@infrastructure/security/guards/roles.guard"

import { KodikMovieCollectionParamsDto } from "../dto/params/kodikMovieCollection.params"
import { KodikMovieCollectionResponseDto } from "../dto/response/kodikMovieCollection.response"
import { KodikMoviesService } from "../services/kodikMovies.service"

@ApiTags("Фильмы Kodik")
@ApiBearerAuth("authToken")
@ApiUnauthorizedResponse({ description: "Требуется токен доступа" })
@ApiForbiddenResponse({ description: "Требуется роль администратора" })
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(EUserRole.ADMIN)
@Controller("sources/kodik/movies")
class MovieImportController {
  constructor(private readonly kodikMoviesService: KodikMoviesService) {}

  @Post("collectNew")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: "Сбор новых фильмов и перепроверка импортированных анонсов",
  })
  @ApiAcceptedResponse({ type: KodikMovieCollectionResponseDto })
  @ApiNotFoundResponse({ description: "Источник Kodik не настроен" })
  collectNew(): Promise<KodikMovieCollectionResponseDto> {
    return this.kodikMoviesService.start()
  }

  @Get("jobs/:id")
  @ApiOperation({ summary: "Получение статуса задачи сбора фильмов" })
  @ApiOkResponse({ type: KodikMovieCollectionResponseDto })
  @ApiNotFoundResponse({ description: "Задача сбора фильмов не найдена" })
  getStatus(
    @Param() params: KodikMovieCollectionParamsDto,
  ): Promise<KodikMovieCollectionResponseDto> {
    return this.kodikMoviesService.getStatus(params.id)
  }
}

export { MovieImportController }
