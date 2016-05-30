spybot
======

Spybot is a Slack bot that runs Spyfall games.

Setup
-----
You need 2 files: `settings.json` and `locations.json`

`settings.json`:
```
{
  "token": "bot-user-token",
  "channel": "room-id"
 }
```

`locations.json`:

Right now all locations must have 7 roles
```
{
  "locations": [
    {
      "name": "A Name",
      "roles": ["An", "Array", "Of", "Roles"],
      "url": "A link that should describe the location"
    },
    ...
  ]
}
```

TODO
---
 - Support for multiple concurrent games;
  - One game per room the bot is in;
 - Remove room id from settings file;
 - Support locations with different number of roles;
  - Have the bot automatically filter out locations that don't have enough roles for the number of players playing when choosing a location;
 - Static page for the spy to see all locations;

PIPE DREAMS
----------
 - Build the bot as an engine that takes JSON files describing any game, and has a library of games that it can run;
 - Grab game data(e.g.: locations) from an API endpoint;
