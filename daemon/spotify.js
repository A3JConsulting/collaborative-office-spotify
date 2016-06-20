var SpotifyWebApi = require('spotify-web-api-node');
const util = require('util')

var Spotify = function(clientId, clientSecret, masterPlaylist, redis, redirectUri) {

  var spotifyApi = new SpotifyWebApi({
    clientId : clientId,
    clientSecret : clientSecret,
    redirectUri: redirectUri
  });

  this.redis = redis;

  this.dirty = false;

  this.masterPlaylist = masterPlaylist

  this.setTokens = function(accessToken, refreshToken) {
    spotifyApi.setAccessToken(accessToken);
    this.redis.set('access_token', accessToken);
    if (refreshToken) {
      spotifyApi.setRefreshToken(refreshToken);
      this.redis.set('refresh_token', refreshToken);
    }
    util.log('Tokens refreshed');
  }

  this.getPlaylistURI = function() {
    return 'spotify:user:' + this.masterPlaylist['user'] + ':playlist:' + this.masterPlaylist['playlist'];
  };

  this.mixPlaylist = function(playlists, retry) {
    var promises = [];
    playlists.forEach(function(playlist) {
      if (playlist.user) {
        promises.push(spotifyApi.getPlaylistTracks(playlist.user, playlist.playlist));
      } else {
        promises.push(spotifyApi.getAlbumTracks(playlist.album));
      }
    });
    return new Promise(function(resolve, reject) {
      Promise.all(promises).then(function(data) {
        var tracks = [];
        var average_length = data.length ? parseInt(data.reduce(function(sum, playlist) { return sum + playlist.body.items.length; }, 0)/data.length) : 0;
        util.log(data.length + " playlists. Average length: " + average_length);
        data.forEach(function(playlist) {
          playlist.body.items.slice(0, average_length).forEach(function(item) {
            tracks.push(item.track ? item.track.uri : item.uri);
          });
        });
        tracks = [...new Set(tracks)];
        this.replaceTracksInPlaylist(tracks).then(function(data) {
          resolve(data)
        }, function(error) {
          reject(error);
        });
      }.bind(this), function(reason) {
        if (reason.statusCode == 401) {
          if (!retry) {
            spotifyApi.refreshAccessToken()
            .then(function(data) {
              if (data.body.refresh_token) {
                this.setTokens(data.body.access_token, data.body.refresh_token);
              } else {
                this.setTokens(data.body.access_token, false);
              }
              resolve(this.mixPlaylist(playlists, true));
            }.bind(this), function(err) {
              reject('Could not refresh access token', err);
            });
          } else {
            reject('Something went terribly wrong');
          }
        } else {
          reject(reason);
        }
      }.bind(this));
    }.bind(this));
  }

  this.replaceTracksInPlaylist = function(tracks) {
    var maxTracks = 100;
    // Get all tracks in current playlist
    return new Promise(function(resolve, reject) {
      var aggregatedTracks = [];
      function loadTracks(user, playlist, offset) {
        return new Promise(function(resolve2, reject2) {
          spotifyApi.getPlaylistTracks(user, playlist, { 'offset': offset, 'limit':maxTracks }).then(function(data) {
            if (data.body.items) {
              data.body.items.forEach(function(item) {
                aggregatedTracks.push(item.track.uri);
              });
              if (data.body.next) {
                resolve2(loadTracks(user, playlist, (offset+maxTracks)));
              } else {
                resolve2(aggregatedTracks);
              }
            } else {
              resolve2(aggregatedTracks);
            }
          }, function(error) {
            reject2(error);
            util.log(error);
          });
        });
      }

      loadTracks(this.masterPlaylist.user, this.masterPlaylist.playlist, 0).then(function(existingTracks) {
        existingTracks = new Set(existingTracks);
        tracks = new Set(tracks);

        var remove = [...new Set([...existingTracks].filter(x => !tracks.has(x)))].map(function(uri) { return { uri: uri }; });
        var add = [...new Set([...tracks].filter(x => !existingTracks.has(x)))];
        var actions = [];

        for (var i=0 ; i<remove.length ; i += maxTracks) {
          actions.push(spotifyApi.removeTracksFromPlaylist(this.masterPlaylist.user, this.masterPlaylist.playlist, remove.slice(i, i+maxTracks)))
        }
        for (var i=0 ; i<add.length ; i += maxTracks) {
          actions.push(spotifyApi.addTracksToPlaylist(this.masterPlaylist.user, this.masterPlaylist.playlist, add.slice(i, i+maxTracks)))
        }

        Promise.all(tracks).then(function(data) {
          resolve({'added': add.length, 'removed': remove.length});
        }, function(error) {
          util.log(error);
          reject(error);
        });
      }.bind(this), function(error) {
        reject(error);
      });
    }.bind(this));
  }

  this.getCode = function() {
    var scopes = ['playlist-modify-private', 'playlist-modify-public'],
    state = 'random-state';
    return spotifyApi.createAuthorizeURL(scopes, state);
  }


  this.getTokens = function(code) {
    return new Promise(function(resolve, reject) {
      spotifyApi.authorizationCodeGrant(code)
      .then(function(data) {
        resolve({
          access_token: data.body['access_token'],
          refresh_token: data.body['refresh_token']
        });
      }, function(err) {
        console.log('Something went wrong!', err);
        reject();
      });
    }.bind(this));
  }
}

module.exports = Spotify;
