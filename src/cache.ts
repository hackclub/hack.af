import { LRUCache } from "lru-cache/raw";

export const cache = new LRUCache({
  max: parseInt(Bun.env.CACHE_SIZE ?? "500", 10),
  ttl: parseInt(Bun.env.CACHE_TTL ?? "60", 10) * 1000, // in seconds, 1 minute default
});
