export interface CacheProvider {
  get(key: string): Promise<any | null>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export class MemoryCache implements CacheProvider {
  private cache: Map<string, { value: any; expiry: number }> = new Map();

  async get(key: string): Promise<any | null> {
    const item = this.cache.get(key);
    if (!item) return null;

    if (item.expiry < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  async set(key: string, value: any, ttl = 3600): Promise<void> {
    const expiry = Date.now() + ttl * 1000;
    this.cache.set(key, { value, expiry });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }
}
