import { BadRequestException } from '@nestjs/common';
import { isValidObjectId } from 'mongoose';

import type { CursorValue } from './encodeCursor';

export function decodeCursor(cursor: string): CursorValue {
  try {
    const value = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as Partial<CursorValue>;

    if (
      typeof value.updatedAt !== 'string' ||
      Number.isNaN(Date.parse(value.updatedAt)) ||
      typeof value.id !== 'string' ||
      !isValidObjectId(value.id)
    ) {
      throw new Error('Invalid cursor payload');
    }

    return {
      updatedAt: value.updatedAt,
      id: value.id,
    };
  } catch {
    throw new BadRequestException({
      statusCode: 400,
      code: 'invalid_request',
      message: 'The list cursor is invalid',
    });
  }
}
