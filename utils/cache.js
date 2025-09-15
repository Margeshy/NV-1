const cache = new Map();

function getWithCache(key, fetchFn, ttl = 300) {
  if (cache.has(key) && (Date.now() - cache.get(key).timestamp) < ttl * 1000) {
    return cache.get(key).data;
  }
  const data = fetchFn();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
}

module.exports = {
  getWithCache,
};