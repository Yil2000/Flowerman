import NodeCache from "node-cache";

const cache = new NodeCache({ stdTTL: 86400 }); // 24 שעות

export function cacheMiddleware(req, res, next) {
  const key = req.originalUrl;
  const cached = cache.get(key);

  if (cached) {
    if (cached.isJson) return res.json(cached.data);
    return res.send(cached.data);
  }

  const originalSend = res.send.bind(res);
  const originalJson = res.json.bind(res);

  res.send = (body) => {
    cache.set(key, { data: body, isJson: false });
    return originalSend(body);
  };

  res.json = (data) => {
    cache.set(key, { data, isJson: true });
    return originalJson(data);
  };

  next();
}
