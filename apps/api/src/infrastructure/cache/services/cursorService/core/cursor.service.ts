import { createHash } from "node:crypto"

import { BadRequestException, Injectable } from "@nestjs/common"

import { isArray } from "@shared/functions/checks/isArray"

import type { ICreateCursorProps } from "../types/ICreateCursorProps"
import type { IReadCursorProps } from "../types/IReadCursorProps"

const CURSOR_VERSION = 1

@Injectable()
class CursorService {
  create(props: ICreateCursorProps) {
    const { scope, position } = props
    const payload = [CURSOR_VERSION, this.hashScope(scope), position]

    return Buffer.from(JSON.stringify(payload)).toString("base64url")
  }

  read<T>(props: IReadCursorProps<T>): T {
    const { cursor, scope, isPosition, invalidCursorMessage } = props
    let payload: unknown

    try {
      const buffer = Buffer.from(cursor, "base64url")

      if (buffer.toString("base64url") === cursor) {
        payload = JSON.parse(buffer.toString("utf8"))
      }
    } catch (error) {
      throw new BadRequestException(invalidCursorMessage, { cause: error })
    }

    if (isArray(payload) && payload.length === 3) {
      const [version, hash, position] = payload

      if (
        version === CURSOR_VERSION &&
        hash === this.hashScope(scope) &&
        isPosition(position)
      ) {
        return position
      }
    }

    throw new BadRequestException(invalidCursorMessage)
  }

  private hashScope(scope: readonly unknown[]) {
    return createHash("sha256")
      .update(JSON.stringify(scope))
      .digest("base64url")
  }
}

export { CursorService }
