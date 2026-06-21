import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

import { ConfigService } from '../config/config.service';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(configService: ConfigService) {
    this.client = new Redis(configService.redisOptions);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  async ping(): Promise<boolean> {
    return (await this.client.ping()) === 'PONG';
  }

  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    return value === null ? null : (JSON.parse(value) as T);
  }

  async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);

    if (ttlSeconds === undefined) {
      await this.client.set(key, serialized);
      return;
    }

    await this.client.set(key, serialized, 'EX', ttlSeconds);
  }

  async getHashJson<T>(key: string, field: string): Promise<T | null> {
    const value = await this.client.hget(key, field);
    return value === null ? null : (JSON.parse(value) as T);
  }

  async getHashJsonAll<T>(key: string): Promise<Record<string, T>> {
    const values = await this.client.hgetall(key);

    return Object.fromEntries(
      Object.entries(values).map(([field, value]) => [
        field,
        JSON.parse(value) as T,
      ]),
    );
  }

  async setHashJson<T>(key: string, field: string, value: T): Promise<void> {
    await this.client.hset(key, field, JSON.stringify(value));
  }

  async deleteHashFields(key: string, ...fields: string[]): Promise<number> {
    return fields.length === 0 ? 0 : this.client.hdel(key, ...fields);
  }

  async addSetMembers(key: string, ...members: string[]): Promise<number> {
    return members.length === 0 ? 0 : this.client.sadd(key, ...members);
  }

  async removeSetMembers(key: string, ...members: string[]): Promise<number> {
    return members.length === 0 ? 0 : this.client.srem(key, ...members);
  }

  async getSetMembers(key: string): Promise<string[]> {
    return this.client.smembers(key);
  }

  async acquireLock(
    key: string,
    owner: string,
    ttlMilliseconds: number,
  ): Promise<boolean> {
    return (await this.client.set(key, owner, 'PX', ttlMilliseconds, 'NX')) === 'OK';
  }

  async releaseLock(key: string, owner: string): Promise<boolean> {
    const result = await this.client.eval(
      `
        if redis.call('get', KEYS[1]) == ARGV[1] then
          return redis.call('del', KEYS[1])
        end

        return 0
      `,
      1,
      key,
      owner,
    );

    return result === 1;
  }

  async refreshLock(
    key: string,
    owner: string,
    ttlMilliseconds: number,
  ): Promise<boolean> {
    const result = await this.client.eval(
      `
        if redis.call('get', KEYS[1]) == ARGV[1] then
          return redis.call('pexpire', KEYS[1], ARGV[2])
        end

        return 0
      `,
      1,
      key,
      owner,
      ttlMilliseconds,
    );

    return result === 1;
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    return (await this.client.expire(key, ttlSeconds)) === 1;
  }

  async delete(key: string): Promise<number> {
    return this.client.del(key);
  }

  async increment(key: string): Promise<number> {
    return this.client.incr(key);
  }

  executeScript<T>(
    script: string,
    keys: string[],
    args: Array<string | number>,
  ): Promise<T> {
    return this.client.eval(
      script,
      keys.length,
      ...keys,
      ...args,
    ) as Promise<T>;
  }
}
