const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 600 }); // TTL = 10 דקות

function cacheMiddleware(req, res, next) {
  const key = req.originalUrl;
  const cachedContent = cache.get(key);

  if (cachedContent) {
    console.log("Serving from cache:", key);
    return res.send(cachedContent);
  }

  // שמירת send המקורי כדי לשמור את התוכן ב-cache
  res.originalSend = res.send;
  res.send = (body) => {
    cache.set(key, body);
    res.originalSend(body);
  };

  next();
}

module.exports = cacheMiddleware;
