import { LRUCache } from 'lru-cache';

export class SimpleMemoryCache {
  private cache: LRUCache<string, any>;

  constructor() {
    this.cache = new LRUCache({
      max: 50000,
    });
  }

  private _key(key: any, namespace?: string): string {
    return `${namespace || 'default'}:${key}`;
  }

  async get(key: any, default_value: any = undefined, namespace?: string): Promise<any> {
    const k = this._key(key, namespace);
    const val = this.cache.get(k);
    return val !== undefined ? val : default_value;
  }

  async set(key: any, value: any, ttl?: number, namespace?: string): Promise<void> {
    const k = this._key(key, namespace);
    this.cache.set(k, value, ttl ? { ttl: ttl * 1000 } : undefined);
  }

  async multi_set(items: Iterable<[any, any]>, namespace?: string): Promise<void> {
    for (const [key, value] of items) {
      await this.set(key, value, undefined, namespace);
    }
  }

  async multi_get(keys: Iterable<any>, namespace?: string): Promise<any[]> {
    const results = [];
    for (const key of keys) {
      const val = await this.get(key, undefined, namespace);
      if (val !== undefined) results.push(val);
    }
    return results;
  }
}
