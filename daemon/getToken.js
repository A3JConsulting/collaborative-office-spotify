var SpotifyWebApi = require('spotify-web-api-node');
require('dotenv').config({ silent: true });

var code = false;

if (process.argv.length > 2) {
  if (process.argv[2] == 'code') {
    if (process.argv.length == 3) {
      console.log('Missing code');
    } else {
      code = process.argv[3]
    }
  } else {
    return;
  }
}

var scopes = ['playlist-modify-private', 'playlist-modify-public'],
    redirectUri = 'https://example.com/callback',
    clientId = process.env.SPOTIFY_CLIENTID,
    clientSecret = process.env.SPOTIFY_CLIENTSECRET,
    state = 'some-state-of-my-choice';

var spotifyApi = new SpotifyWebApi({
  redirectUri : redirectUri,
  clientId : clientId,
  clientSecret : clientSecret
});

if (!code) {
  // Create the authorization URL 
  var authorizeURL = spotifyApi.createAuthorizeURL(scopes, state);
  console.log(authorizeURL);
} else {
  spotifyApi.authorizationCodeGrant(code)
  .then(function(data) {
    console.log('The token expires in ' + data.body['expires_in']);
    console.log('The access token is ' + data.body['access_token']);
    console.log('The refresh token is ' + data.body['refresh_token']);

    // Set the access token on the API object to use it in later calls 
    spotifyApi.setAccessToken(data.body['access_token']);
    spotifyApi.setRefreshToken(data.body['refresh_token']);
  }, function(err) {
    console.log('Something went wrong!', err);
  });

}
