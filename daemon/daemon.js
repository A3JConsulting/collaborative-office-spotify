const ip = require("ip");
const subnet = ip.subnet(ip.address(), "255.255.255.0");
const get_mac_addresses = require("./network").get_mac_addresses;
const getHookedUpMacs = require("./lib/macs").getHookedUpMacs;
const sets = require("./lib/sets");
const getPlaylist = require("./lib/playlist").getPlaylist;
const util = require('util')

var playListCompare = (a, b) => {
  a_json = JSON.stringify(a);
  b_json = JSON.stringify(b);
  if (a_json < b_json) return -1;
  if (a_json > b_json) return 1;
  return 0;
}

module.exports = {
  run: (redisClient, spotifyClient) => {
    return new Promise((resolve, reject) => {
      Promise.all([
        get_mac_addresses(subnet.broadcastAddress),
        getHookedUpMacs(redisClient)
      ]).then((result) => {
        const onlineAndHookedUp = sets.intersection(result[0], result[1]);
        redisClient.get("online_macs", (err, prevMacsJson) => {
          const prevMacs = JSON.parse(prevMacsJson) || [];
          if (!sets.equals(prevMacs, onlineAndHookedUp)) {
            redisClient.set("online_macs", JSON.stringify([...onlineAndHookedUp]));
          }
          Promise.all([...onlineAndHookedUp].map((mac) => { return getPlaylist(mac, redisClient); })).then((playlists) => {
            redisClient.get("current_playlists", (err, prevPlaylistsJson) => {
              var prevPlaylists = JSON.parse(prevPlaylistsJson) || [];
              playlists = playlists.filter((playlist) => { return playlist != null; });
              prevPlaylists.sort(playListCompare);
              playlists.sort(playListCompare);
              if (err) {
                util.log("Error in get current_playlists");
              }
              if (JSON.stringify(prevPlaylists) != JSON.stringify(playlists)) {
                redisClient.set("current_playlists", JSON.stringify(playlists));
                util.log("Pushing new playlist to Spotify");
                util.log(JSON.stringify(playlists));
                spotifyClient.mixPlaylist(playlists)
                  .then((data) => {
                    util.log("Pushed new playlist to Spotify: added " + data['added'] + ", removed " + data['removed']);
                    if (data['added'] || data['removed']) {
                      setTimeout(function(spotifyClient) {
                        spotifyClient.dirty = true;
                      }, 30000, spotifyClient);
                    }
                    resolve(null);
                  }).catch((err) => {
                    util.log(err);
                    resolve(null);
                  });
              } else {
                resolve(null);
              }
            });
          }).catch((err) => {
            util.error("Failed online and hookedup")
            resolve(null);
          });
        });
      }).catch((err) => {
        util.error("FAILED");
        util.log(err);
        resolve(null);
      });
    });
  }
}
