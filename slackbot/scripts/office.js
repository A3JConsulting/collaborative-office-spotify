/*
 * Description:
 *   Scripts for A3J Consulting's hubot
 *
 * Configuration:
 *   REDIS_URL - redis server to connect to
 *   PLAYBACK_NOTIFY_CHANNEL - channel to post playback updates to
 *   MOPIDY_WS_URL - url to mopidy's web socket
 *
 * Commands:
 *   hubot <trigger> - <what the respond trigger does>
 *   hookup mac <mac_address> - (private) associate your user with a mac address for a device you control. Multiple devices can be hooked up.
 *   forget mac <mac_address> - (private) disassociate a mac address from your user.
 *   gimme macs - (private) list your associated mac addresses.
 *   hookup playlist <spotify_uri> - (private) associate your user with a spotify playlist. Replaces any previous playlist association.
 *   play music - start the music playback
 *   pause music - pause the music playback
 *   next song - skip to next song
 *   haddaway - this one is obvious, right?
 *
 * Notes:
 *   Relies on a mopidy server running and listening on a websocket on the same machine hubot is running
 *
 * Author:
 *   https://github.com/A3JConsulting/
 */

const redis = require('../lib/redis');
const Mopidy = require('mopidy');
const macs_key = 'macs_{user_id}';
const playlist_key = 'playlist_{user_id}';
const mopidy = new Mopidy({
  webSocketUrl: process.env.MOPIDY_WS_URL,
  callingConvention: "by-position-or-by-name",
  autoConnect: true
});

const ensure_private = (res, ok) => {
  if (res.message.user.name !== res.message.room) {
    res.send("Shhhh! Not in public");
  } else {
    ok();
  }
}

const ensure_public = (res, ok) => {
  if (res.message.user.name !== res.message.room) {
    ok();
  } else {
    res.send("Dude, don't be so sneaky about it - command me in a public channel instead!");
  }
}

const package_tracks = (tracks) => {
  const trackUris = tracks.map(track => { return track.uri; });
  return new Promise((resolve, reject) => {
    mopidy.library.getImages({uris: trackUris}).then((imageMap) => {
      const trackList = tracks.map((track) => {
        var thumb_url = null;
        if (imageMap.hasOwnProperty(track.uri)) {
          const imageSizes = new Map(imageMap[track.uri].map((image) => { return [image.width, image]; }));
          thumb_url = imageSizes.get(Math.min(...(imageSizes.keys()))).uri;
        }
        return {
          fallback: track.artists[0].name + " - " + track.name,
          author_name: track.artists[0].name,
          author_link: track.artists[0].uri.replace("spotify:", "https://open.spotify.com/").replace(/:([^\/])/g, "/$1"),
          title: track.name,
          title_link: track.uri.replace("spotify:", "https://open.spotify.com/").replace(/:([^\/])/g, "/$1"),
          text: track.album.name,
          thumb_url: thumb_url
        };
      });
      resolve(trackList);
    });
  });
}

module.exports = (robot) => {
  mopidy.on("event:trackPlaybackStarted", (track) => {
    package_tracks([track.tl_track.track]).then((trackList) => {
      robot.adapter.customMessage({
        channel: "#" + process.env.PLAYBACK_NOTIFY_CHANNEL,
        text: "Dudes, now playing...",
        attachments: trackList
      });
    });
  });

  mopidy.on("event:trackPlaybackPaused", () => {
    robot.messageRoom("#" + process.env.PLAYBACK_NOTIFY_CHANNEL, "Dudes, pausing music for a while");
  });

  mopidy.on("event:trackPlaybackResumed", (track) => {
    if (track) {
      package_tracks([track.tl_track.track]).then((trackList) => {
        robot.adapter.customMessage({
          channel: "#" + process.env.PLAYBACK_NOTIFY_CHANNEL,
          text: "Dudes, now playing...",
          attachments: trackList
        });
      });
    }
  });

  robot.hear(/hookup mac (.*)/i, (res) => {
    ensure_private(res, () => {
      const key = macs_key.replace("{user_id}", res.message.user.id);
      const mac = res.match[1];
      redis.sadd(key, mac);
      res.send("Just this once, and only for you!");
    });
  });

  robot.hear(/forget mac (.*)/i, (res) => {
    ensure_private(res, () => {
      const key = macs_key.replace("{user_id}", res.message.user.id);
      const mac = res.match[1];
      redis.srem(key, mac);
      res.send("Already forgotten about");
    });
  });

  robot.hear(/gimme macs/i, (res) => {
    ensure_private(res, () => {
      const key = macs_key.replace("{user_id}", res.message.user.id);
      redis.smembers(key, (err, macs) => {
        if (err) {
          res.send("Shit blew up! Looksie: " + err);
        } else if (macs.length == 0) {
          res.send("Dude, your all out!");
        } else {
          res.send("Yours are: " + macs);
        }
      });
    });
  });

  robot.hear(/hookup playlist (.*)/i, (res) => {
    ensure_private(res, () => {
      const key = playlist_key.replace("{user_id}", res.message.user.id);
      const playlist = res.match[1];
      redis.set(key, playlist);
      res.send("Got it");
    });
  });

  robot.hear(/play music/i, (res) => {
    ensure_public(res, () => {
      mopidy.playback.getState().then((state) => {
        if (state == "playing") {
          res.send("Already pumpin', shut up and listen...");
        } else {
          res.send("Alrighty, pumpin' it!");
          mopidy.playback.play();
        }
      });
    });
  });

  robot.hear(/pause music/i, (res) => {
    ensure_public(res, () => {
      res.send("Ok, shutting up...");
      mopidy.playback.pause();
    });
  });

  robot.hear(/next song/i, (res) => {
    ensure_public(res, () => {
      res.send("Comin' up!");
      mopidy.playback.next().then(() => {
        mopidy.playback.getState().then((state) => {
          if (state !== "playing") {
            mopidy.playback.play();
          }
        });
      });
    });
  });

  robot.hear(/haddaway/i, (res) => {
    ensure_public(res, () => {
      mopidy.tracklist.filter({uri: ["spotify:track:2IHaGyfxNoFPLJnaEg4GTs"]}).then((tracks) => {
        if (tracks.length) {
          var p = new Promise((resolve, reject) => {
            resolve(tracks);
          });
        } else {
          var p = mopidy.tracklist.add({uri: "spotify:track:2IHaGyfxNoFPLJnaEg4GTs"});
        }
        p.then((tracks) => {
          res.send("WHAT IS LOOOOVE?");
          mopidy.playback.play([tracks[0]]);
        });
      });
    });
  });

  robot.hear(/gimme playlist contrib/i, (res) => {
    ensure_private(res, () => {
      res.send("Based on users Foo, Bar with playlists baz, bam");
    });
  });

  robot.hear(/update spotify token/i, (res) => {
    ensure_private(res, () => {
      const redisSub = redis.duplicate();
      redisSub.on("message", (channel, msg) => {
        msg = JSON.parse(msg);
        if (msg.type == "auth") {
          res.send("Ok, goto " + msg.authUrl + " and give me the auth code, like 'set spotify auth code YOUR_AUTH_CODE'");
          redisSub.quit();
        }
      });
      const respChannel = `spotify_auth_${res.message.user.id}`;
      redisSub.subscribe(respChannel);

      redis.publish("spotify", JSON.stringify({
        type: "authCode.requested",
        respondOn: respChannel
      }));

      res.send("Starting auth...");
    });
  });

  robot.hear(/set spotify auth code (.*)/i, (res) => {
    ensure_private(res, () => {
      const redisSub = redis.duplicate();
      redisSub.on("message", (channel, msg) => {
        msg = JSON.parse(msg);
        if (msg.type == "authenticated") {
          res.send("Alrighty, all done!");
          redisSub.quit();
        }
      });
      const respChannel = `spotify_auth_${res.message.user.id}`;
      const authCode = res.match[1];
      redisSub.subscribe(respChannel);

      redis.publish("spotify", JSON.stringify({
        type: "authCode.received",
        authCode: authCode,
        respondOn: respChannel
      }));

      res.send("Finalizing...");
    });
  });

  robot.hear(/list songs/, (res) => {
    ensure_private(res, () => {
      mopidy.tracklist.getTracks().then((tracks) => {
        package_tracks(tracks).then((trackList) => {
          robot.adapter.customMessage({
            channel: res.message.room,
            text: "Current track list",
            attachments: trackList
          });
        });
      });
    });
  });
};
