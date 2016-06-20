const playlist_pattern = new RegExp('spotify\:user\:([^\:]*)\:playlist\:([^$]*)');
const album_pattern = new RegExp('spotify\:album\:([^$]*)');
const key_pattern = /macs\_(.*)/;

const getPlaylist = (mac, redisClient) => {
  return new Promise((resolve, reject) => {
    redisClient.keys("macs_*", (err, keys) => {
      if (err) {
        resolve(null);
      }

      const commands = keys.map((key) => { return ["sismember", key, mac]; });
      redisClient.batch(commands).exec((err, replies) => {
        var found_key = false;
        replies.forEach((found, index) => {
          if (found == 1) {
            found_key = true;
            redisClient.get('playlist_' + key_pattern.exec(commands[index][1])[1], (err, reply) => {
              if (reply) {
                if(playlist_pattern.test(reply)) {
                  var match = playlist_pattern.exec(reply);
                  resolve({'user': match[1], 'playlist': match[2]})
                } else if(album_pattern.test(reply)) {
                  var match = album_pattern.exec(reply);
                  resolve({'album': match[1]})
                } else {
                  resolve(null);
                }
              } else {
                resolve(null);
              }
            });
          }
        });
        if (!found_key) {
          resolve(null);
        }
      });
    });
  });
}

module.exports = {
  getPlaylist: getPlaylist
}
