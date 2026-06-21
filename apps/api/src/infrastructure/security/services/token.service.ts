import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { ConfigService } from '../../config/config.service';

const TOKEN_PREFIX = 'f95_';
const TOKEN_BYTES = 32;
const IV_BYTES = 12;
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

export interface EncryptedToken {
  encrypted: string;
  iv: string;
  authenticationTag: string;
  keyVersion: string;
}

@Injectable()
export class TokenService {
  private readonly encryptionKey: Buffer;

  constructor(private readonly configService: ConfigService) {
    this.encryptionKey = Buffer.from(
      configService.tokenEncryptionKey,
      'base64',
    );
  }

  generate(): string {
    return `${TOKEN_PREFIX}${randomBytes(TOKEN_BYTES).toString('base64url')}`;
  }

  hash(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('base64url');
  }

  encrypt(token: string): EncryptedToken {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(
      ENCRYPTION_ALGORITHM,
      this.encryptionKey,
      iv,
    );
    const encrypted = Buffer.concat([
      cipher.update(token, 'utf8'),
      cipher.final(),
    ]);

    return {
      encrypted: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authenticationTag: cipher.getAuthTag().toString('base64'),
      keyVersion: this.configService.tokenEncryptionKeyVersion,
    };
  }

  decrypt(encryptedToken: EncryptedToken): string {
    if (
      encryptedToken.keyVersion !==
      this.configService.tokenEncryptionKeyVersion
    ) {
      throw new Error('Unsupported token encryption key version');
    }

    const decipher = createDecipheriv(
      ENCRYPTION_ALGORITHM,
      this.encryptionKey,
      Buffer.from(encryptedToken.iv, 'base64'),
    );
    decipher.setAuthTag(
      Buffer.from(encryptedToken.authenticationTag, 'base64'),
    );

    return Buffer.concat([
      decipher.update(Buffer.from(encryptedToken.encrypted, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }
}
