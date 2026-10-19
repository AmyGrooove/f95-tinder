import { Injectable, NotFoundException } from "@nestjs/common"
import {
  HttpClient,
  HttpParseError,
  HttpResponseError,
  InjectHttpClient,
} from "@nestjs/http-client"

import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"
import { NonRetryableJobError } from "@infrastructure/jobs/errors/NonRetryableJobError"
import { isArray } from "@shared/functions/checks/isArray"
import { isInt } from "@shared/functions/checks/isInt"
import { isNil } from "@shared/functions/checks/isNil"
import { isNonNegativeSafe } from "@shared/functions/checks/isNonNegativeSafe"
import { isObject } from "@shared/functions/checks/isObject"
import { isString } from "@shared/functions/checks/isString"

import { KODIK_SETTINGS } from "../static/KODIK_SETTINGS"
import type {
  IKodikCommonParameters,
  IKodikListParameters,
  IKodikSearchParameters,
} from "../types/IKodikParameters"
import type { IKodikMaterial, IKodikPage } from "../types/IKodikResponse"
import { SourceRepository } from "./source.repository"

@Injectable()
class KodikService {
  constructor(
    private readonly config: InfrastructureConfigService,
    private readonly sourceRepository: SourceRepository,
    @InjectHttpClient(KODIK_SETTINGS.clientName)
    private readonly httpClient: HttpClient,
  ) {}

  async getSource() {
    const source = await this.sourceRepository.read.findOne({ key: "kodik" })

    if (isNil(source)) {
      throw new NotFoundException(DICTIONARY.kodik.sourceNotFound)
    }

    return source
  }

  async list(parameters: IKodikListParameters = {}, nextPage?: string) {
    const url = isNil(nextPage)
      ? new URL("/list", KODIK_SETTINGS.apiUrl)
      : this.parsePageUrl(nextPage)

    return this.request(url, parameters)
  }

  async search(parameters: IKodikSearchParameters) {
    const isSearchSpecified = KODIK_SETTINGS.searchFields.some((field) => {
      const value = parameters[field]

      return (
        (isString(value) && value.trim().length > 0) ||
        (isInt(value) && value > 0)
      )
    })

    if (!isSearchSpecified) {
      throw new NonRetryableJobError(DICTIONARY.kodik.searchRequired)
    }

    return this.request(new URL("/search", KODIK_SETTINGS.apiUrl), parameters)
  }

  async findById(id: string, parameters: IKodikCommonParameters = {}) {
    return this.search({ ...parameters, id })
  }

  serializePage(page: IKodikPage) {
    const sanitized = {
      ...page,
      next_page: this.sanitizePageUrl(page.next_page),
      prev_page: this.sanitizePageUrl(page.prev_page),
    }

    return Buffer.from(
      JSON.stringify(sanitized).replaceAll(
        this.config.sources.kodikApiToken,
        "[REDACTED]",
      ),
    )
  }

  private async request(url: URL, parameters: IKodikCommonParameters) {
    for (const [key, value] of Object.entries(parameters)) {
      if (!isNil(value)) {
        url.searchParams.set(key, String(value))
      }
    }

    url.searchParams.set("token", this.config.sources.kodikApiToken)

    let data: unknown

    try {
      const response = await this.httpClient.get<unknown>(url.toString(), {
        responseType: "json",
      })

      data = response.data
    } catch (error) {
      throw this.createRequestError(error)
    }

    if (!this.checkIsPage(data)) {
      throw new NonRetryableJobError(DICTIONARY.kodik.invalidResponse)
    }

    return data
  }

  private createRequestError(error: unknown) {
    if (error instanceof HttpParseError) {
      return new NonRetryableJobError(DICTIONARY.kodik.invalidResponse)
    }

    const isRequestRejected =
      error instanceof HttpResponseError &&
      error.status >= 400 &&
      error.status < 500 &&
      ![408, 425, 429].includes(error.status)

    if (isRequestRejected) {
      return new NonRetryableJobError(DICTIONARY.kodik.requestFailed)
    }

    return new Error(DICTIONARY.kodik.requestFailed)
  }

  private checkIsPage(value: unknown): value is IKodikPage {
    return (
      isObject(value) &&
      !isArray(value) &&
      "total" in value &&
      isInt(value.total) &&
      isNonNegativeSafe(value.total) &&
      "results" in value &&
      isArray(value.results) &&
      value.results.every((record) => this.checkIsMaterial(record)) &&
      (!("time" in value) || isString(value.time)) &&
      (!("next_page" in value) ||
        isNil(value.next_page) ||
        isString(value.next_page)) &&
      (!("prev_page" in value) ||
        isNil(value.prev_page) ||
        isString(value.prev_page))
    )
  }

  private checkIsMaterial(value: unknown): value is IKodikMaterial {
    return (
      isObject(value) &&
      !isArray(value) &&
      "id" in value &&
      isString(value.id) &&
      value.id.trim().length > 0 &&
      "type" in value &&
      isString(value.type) &&
      value.type.trim().length > 0 &&
      (!("material_data" in value) ||
        isNil(value.material_data) ||
        (isObject(value.material_data) && !isArray(value.material_data)))
    )
  }

  private parsePageUrl(value: string) {
    let url: URL

    try {
      url = new URL(value)
    } catch {
      throw new NonRetryableJobError(DICTIONARY.kodik.invalidPageUrl)
    }

    if (
      url.origin !== KODIK_SETTINGS.apiUrl ||
      url.pathname !== "/list" ||
      url.username !== "" ||
      url.password !== ""
    ) {
      throw new NonRetryableJobError(DICTIONARY.kodik.invalidPageUrl)
    }

    return url
  }

  private sanitizePageUrl(value?: string | null) {
    if (isNil(value)) {
      return value
    }

    const url = this.parsePageUrl(value)
    url.searchParams.delete("token")

    return url.toString()
  }
}

export { KodikService }
