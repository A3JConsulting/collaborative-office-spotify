module.exports = {
  getHookedUpMacs: (redisClient) => {
    return new Promise((resolve, reject) => {
      redisClient.keys("macs_*", (err, keys) => {
        if (err) {
          reject(err);
          return;
        }

        var macs = [];
        var errs = [];
        const commands = keys.map((key) => { return ["smembers", key]; });
        redisClient.batch(commands).exec((err, replies) => {
          if (err) {
            reject(err);
            return;
          }
          resolve([...(new Set([].concat(...replies)))]);
        });
      });
    });
  }
};
