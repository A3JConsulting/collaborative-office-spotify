redis = require "redis"
client = redis.createClient process.env.REDIS_URL

module.exports = client
