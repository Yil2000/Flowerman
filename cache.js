import NodeCache from "node-cache";

const cache = new NodeCache({ stdTTL: 600 });

export function cacheMiddleware(req, res, next) {
  const key = req.originalUrl;
  const cached = cache.get(key);

  if (cached) {
    return res.send(cached);
  }

  const originalSend = res.send.bind(res);
  res.send = (body) => {
    cache.set(key, body);
    originalSend(body);
  };

  next();
}
