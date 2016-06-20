const redis = require("redis");

module.exports = () => {
  return redis.createClient(process.env.REDIS_URL);
}
