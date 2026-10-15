import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { decrypt, decryptBuffer, encrypt, encryptBuffer, encryptionKey } from '../common/crypto.js';

@Injectable()
export class CryptoService {
  private readonly key: Buffer;
  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    this.key = encryptionKey(
      config.get('DATA_ENCRYPTION_KEY', { infer: true }),
      config.get('JWT_SECRET', { infer: true }),
      config.get('NODE_ENV', { infer: true }) === 'production',
    );
  }
  encrypt(plain: string) {
    return encrypt(plain, this.key);
  }
  decrypt(payload: string) {
    return decrypt(payload, this.key);
  }
  encryptBuffer(plain: Buffer) {
    return encryptBuffer(plain, this.key);
  }
  decryptBuffer(payload: Buffer) {
    return decryptBuffer(payload, this.key);
  }
}
