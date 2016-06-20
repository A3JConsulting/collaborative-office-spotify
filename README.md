# COS - Collaborative Office Spotify

COS is a platform for automatically generate and play a [Spotify](https://www.spotify.com/) playlist based on people (devices) present on a private LAN (e.g. an office LAN).
Overall, it works the following way:

* Each slack user have the possibility to associate a Spotify playlist and a number of devices mac addresses with its user
* The platform will then keep track of which mac addresses are online on the private LAN it's running on, an get a list of all playlists associated with the corresponding users
* Given the list of playlists generated, a new playlist is constructed as a weighted union of these playlists
* The playlist is shuffled and played through Mopidy
* When a device is entering or leaving the network, or someone online on the network changes his/her associated playlist, the collaborative playlist is regenerated, shuffled and played
* Playback (play, pause, skip song and play [What is love](https://open.spotify.com/track/2IHaGyfxNoFPLJnaEg4GTs)) is controlled through Slack commands, as well as list current playlist etc

Technically, COS consists of two daemons: `slackbot` and `office-playlist-daemon`

## Used technologies

COS requires some additional services to fully function, namely:

* [Spotify](https://www.spotify.com/) login credentials plus a [Spotify app](https://developer.spotify.com/my-applications/#!/) setup
* [Mopidy](https://www.mopidy.com/) server
* [Slack](https://slack.com/) account and one or more services
* [Hubot for slack](https://github.com/slackhq/hubot-slack) for controlling playback, playlist contribution etc
* [Redis](http://redis.io/) for storage and intra-service communication

## Configuration

### Support services

### Spotify

Don't have Spotify yet? Shame on you, go get yourself an account! Then [register a Spotify app](https://developer.spotify.com/my-applications/#!/)

#### Mopidy

Mopidy is the server responsible for the actual audio playback of the generated Spotify playlist.

* [Websocket API](https://docs.mopidy.com/en/latest/api/http/#websocket-api) needs to be up and running
* [Mopidy-Spotify](https://github.com/mopidy/mopidy-spotify) extension needs to be enabled and configured with Spotify login credentials
* [Mopidy-Webhooks](https://github.com/paddycarey/mopidy-webhooks) extension needs to be enabled

See [Mopidy configuration documentation](https://docs.mopidy.com/en/latest/config/) for help settings this up.

#### Slack & Hubot

Go get yourself and setup a Slack account if you haven't already! And setup a [Hubot app](https://slack.com/apps/A0F7XDU93-hubot).


#### Redis

A Redis server needs to be setup and running. Go fix it!

### The daemons

#### office-playlist-daemon

All settings for the playlist manager daemon is controlled through environment variables. These can be set in an .env-file (`daemon/.env`). See `daemon/.env.example`.

Required settings are:

* `REDIS_URL` - connection url to the Redis server to be used
* `SPOTIFY_CLIENTID` - client id for your spotify app - provided for you when configuring your Spotify app
* `SPOTIFY_CLIENTSECRET` - client secret for your spotify app - provided for you when configuring your Spotify app
* `SPOTIFY_PLAYLIST` - Id of the Spotify playlist to use as collaborative playlist. Needs to be accessible and writeable by the Spotify user Mopidy is running on
* `SPOTIFY_USER` - User name of the spotify account owning the collaborative playlist
* `PING_EXECUTABLE` - Device discovery is done by using ping/ICMP to the broadcast IP of the private LAN. This is the ping executable to be used (platform dependent). Examples: `/sbin/ping`, `ping -b` etc
* `MOPIDY_WS_URL` - Websocket url to the Mopidy JSON-RPC API

#### slackbot (hubot-slack)

All settings for hubot is controlled through environment variables. These can be set in an .env-file (`slackbot/.env`). See `slackbot/.env.example`.

Required settings are:

* `REDIS_URL` - connection url to the Redis server to be used
* `HUBOT_SLACK_TOKEN` - provided to youe by the [Slack Hubot integration](https://slack.com/apps/A0F7XDU93-hubot).
* `MOPIDY_WS_URL` - Websocket url to the Mopidy JSON-RPC API
* `PLAYBACK_NOTIFY_CHANNEL` - Name of the channel Hubot should post updates about songs being played to

## Control commands (Slack hubot)

Some commands must be issued in a private conversation with Hubot, others must be issued in a "public" channel.

### Private commands

These commands can only be issued in a private conversation with Slackbot.

* `update spotify token` - start oauth2 flow to get new spotify access and refresh tokens (for playlist management)
* `set spotify auth code <auth-code>` - complete spotify oauth2 flow by supplying authentication code
* `hookup mac <mac-address>` - associate mac address with your user
* `forget mac <mac-address>` - disassociate mac address from your user
* `gimme macs` - list what mac adresses are associated with your user
* `hookup playlist <spotify playlist uri>` - associate a spotify playlis with your user
* `list songs` - get a list of all songs currently in the collaborative playlist

### Public commands

These commands can be issued in any channel Hubot is [setup](https://slack.com/apps/A0F7XDU93-hubot) to be listening to.

* `play music`
* `pause music`
* `next song`
* `haddaway`


Happy playing!!!
