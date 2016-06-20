require('dotenv').config({ silent: true });
const redis = require('./redis');
const Spotify = require("./spotify");
const loop = require('./loop');
const daemon = require('./daemon');
const Mopidy = require('mopidy');
const redisNormal = redis();
const pub = redis();
const sub = redis();
const util = require('util')
const spotifyClient = new Spotify(process.env.SPOTIFY_CLIENTID,
                        process.env.SPOTIFY_CLIENTSECRET,
                        {user: process.env.SPOTIFY_USER, playlist: process.env.SPOTIFY_PLAYLIST}, redisNormal, 'https://example.com/callback');
const mopidy = new Mopidy({
  webSocketUrl: process.env.MOPIDY_WS_URL,
  callingConvention: "by-position-or-by-name"
});

util.log('Starting daemon');

mopidy.on('state:online', function() {
  mopidy.tracklist.setRandom([true]).then(function() {
    mopidy.tracklist.setRepeat([true]);
  }).catch(function() {});
  spotifyClient.dirty = true;
  updateMopidy();
});

mopidy.on('event:playbackStateChanged', function(state) {
  updateMopidy();
});

sub.subscribe('spotify');

sub.on('message', function(channel, message) {
  if (channel == 'spotify') {
    message = JSON.parse(message);

    if (message['type'] == 'authCode.requested') {
      pub.publish(message['respondOn'], JSON.stringify({ type: 'auth', authUrl: spotifyClient.getCode() }));
    } else if (message['type'] == 'authCode.received') {
      spotifyClient.getTokens(message['authCode']).then(function(tokens) {
        pub.publish(message['respondOn'], JSON.stringify( {type: 'authenticated'} ))
        spotifyClient.setTokens(tokens['access_token'], tokens['refresh_token']);
        // Clear client list for playlist update
        redisNormal.set('online_macs', JSON.stringify([]));
      });
    }
  }
});

redisNormal.mget(['access_token', 'refresh_token'], function(err, reply) {
  if (reply != undefined && reply.length == 2 && reply[0] && reply[1]) {
    spotifyClient.setTokens(reply[0], reply[1]);
    // Clear client list for playlist update
    redisNormal.set('online_macs', JSON.stringify([]));
  }
});

function updateMopidy() {
  if (spotifyClient.dirty) {
    spotifyClient.dirty = false;
    util.log("Pushing updated to mopidy");
    mopidy.library.refresh({'uri': spotifyClient.getPlaylistURI()}).then(() => {
      util.log("Refreshed");
      mopidy.playback.getState().then((state) => {
        mopidy.tracklist.clear().then(() => {
          mopidy.tracklist.add({'uri': spotifyClient.getPlaylistURI()}).then(() => {
            util.log("List readded. State is: " + state);
            if (state == 'playing') {
              mopidy.playback.play();
            }
          });
        });
      });
    }).catch(() => {
      util.log("Mopidy connection error")
    });
  }
}

loop(daemon.run.bind(null, redisNormal, spotifyClient), 5000);
