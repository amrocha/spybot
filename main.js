var RtmClient = require('@slack/client').RtmClient;
var MemoryDataStore = require('@slack/client').MemoryDataStore;
var fs = require("fs");

var settings = JSON.parse(fs.readFileSync("settings.json"));
var locationsJson = JSON.parse(fs.readFileSync("locations.json"));

var TOKEN = settings.token || process.env.SLACK_API_TOKEN;
var SPYFALL_CHANNEL = settings.channel || process.env.CHANNEL_ID;
var CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS;
var RTM_EVENTS = require('@slack/client').RTM_EVENTS;
var MAX_PLAYERS = 8;
var LOCATIONS_URL = 'THIS DOESN\'T EXIST YET SORRY I\'M WORKING ON IT';
var LOCATIONS = locationsJson.locations;

var game = {};

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

var rtm = new RtmClient(TOKEN, {
  logLevel: 'debug',
  dataStore: new MemoryDataStore(),
  autoReconnect: true,
  autoMark: true
});


rtm.start();

// Connection established
rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, function (rtmStartData) {
  console.log('Logged in as ' + rtmStartData.self.name + ' of team ' + rtmStartData.team.name + ', but not yet connected to a channel');
});

// Can send messages here
rtm.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, function() {
  // Get the user's name
  var user = rtm.dataStore.getUserById(rtm.activeUserId);
  // Get the team's name
  var team = rtm.dataStore.getTeamById(rtm.activeTeamId);

  // Log the slack team name and the bot's name
  console.log('Connected to ' + team.name + ' as ' + user.name);
});

// Channel has been created
rtm.on(RTM_EVENTS.CHANNEL_CREATED, function (message) {
  console.log('Channel Created!');
});


// Listens to messages/dms
rtm.on(RTM_EVENTS.MESSAGE, function(message) {
  var messageUser = rtm.dataStore.getUserById(message.user);
  console.log('MESSAGE USER')
  console.log(messageUser)

  if (!message.hidden) {
    // ==============================
    // THE PART THAT ACTUALLY MATTERS
    // ==============================
    if (message.channel == SPYFALL_CHANNEL) {
      if (message.text.substr(0, 17) === 'spybot start game') {
        var raw_participants = message.text.substr(17);
        var participants = raw_participants.split(' ');
        for (var i = 0; i < participants.length; i++) {
          if (participants[i].substr(0, 2) !== '<@') {
            participants.splice(i, 1);
          }
        }

        game.participants = participants;
        game.confirmed = false;
        game.started = false;

        rtm.sendMessage('Setting up Game', SPYFALL_CHANNEL);
        rtm.sendMessage('Participants: ' + participants.join(', '), SPYFALL_CHANNEL);
        rtm.sendMessage('Type "spybot confirm" to confirm, or "spybot cancel" to abort', SPYFALL_CHANNEL);
      }
    }
    if (message.text.substr(0, 14) === 'spybot confirm') {
      if(game.hasOwnProperty('confirmed') && !game.confirmed) {
        game.confirmed = true;
        game.started = true;
        rtm.sendMessage('The game has started!', SPYFALL_CHANNEL);

        // Spy
        game.participants.sort(function(a, b) {
          return getRandomInt(0, 100) - getRandomInt(0, 100);
        });

        // Location
        game.location = LOCATIONS[getRandomInt(0, LOCATIONS.length)];
        game.roles = game.location.roles.slice();
        game.roles.sort(function(a, b) {
          return getRandomInt(0, 100) - getRandomInt(0, 100);
        });

        var user_id = game.participants[0].substr(2).substr(0, game.participants[0].length-3);
        var user = rtm.dataStore.getUserById(user_id);
        var dm = rtm.dataStore.getDMByName(user.name);
        game.spy = user;
        rtm.sendMessage('Hello ' + user.name + '!', dm.id);
        rtm.sendMessage('Your role is:  The Spy', dm.id);
        rtm.sendMessage('Use the command "spybot guess <location>" to guess where you are"', dm.id);
        rtm.sendMessage('Here are all the locations in the game ' + LOCATIONS_URL, dm.id);

        for (var i = 1; i < game.participants.length; i++) {
          user_id = game.participants[i].substr(2).substr(0, game.participants[i].length-3);
          user = rtm.dataStore.getUserById(user_id);
          dm = rtm.dataStore.getDMByName(user.name);
          rtm.sendMessage('Hello ' + user.name + '!', dm.id);
          rtm.sendMessage('You are in the:  ' + game.location.name + ' (' + game.location.url + ')', dm.id);
          rtm.sendMessage('You are a: ' + game.roles[i], dm.id);
          rtm.sendMessage('Use the command "spybot accuse @<player>" to start an accusation vote', dm.id);
        }
        rtm.sendMessage('All players have been dmed their roles', SPYFALL_CHANNEL);
        rtm.sendMessage('Ask questions in this room using the following format: "@<player> <question>"', SPYFALL_CHANNEL);
        rtm.sendMessage('@' + user.name + ' asks the first question', SPYFALL_CHANNEL);
      }
    }
    if (message.text.substr(0, 13) === 'spybot cancel') {
      if(game.hasOwnProperty('confirmed') && !game.confirmed) {
          game = {};
          rtm.sendMessage('The game has been cancelled!', SPYFALL_CHANNEL);
      }
    }
    // ADD ANOTHER COMMAND TO CHECK THAT A QUESTION WAS ASKED IN THE CHAT
    if (message.text.substr(0, 13) === 'spybot accuse') {
      var accused = message.text.substr(14);
      if (accused.substr(0, 2) !== '<@') {
        rtm.sendMessage('Please use the format: "spybot accuse @<player>"', SPYFALL_CHANNEL);
      }
      else {
        game.accused = accused.substr(2).substr(0, game.participants[0].length-3);
        game.accusationList = [messageUser.name];
        rtm.sendMessage('Are all players ok with this guess? Type "Yes" or "No"', SPYFALL_CHANNEL);
      }
    }
    if (message.text.substr(0, 3) === 'Yes') {
      if (game.accusationList && game.accused !== messageUser.id) {
        if (game.accusationList.find(messageUser.name) === -1) {
          game.accusationList.push(messageUser.name);
          if (game.accusationList.length === game.participants.length -1) {
            rtm.sendMessage('All players have agreed to accuse @' +  + '', SPYFALL_CHANNEL);
            if (accused === game.spy.id) {
              rtm.sendMessage('@' + game.spy.name + ' was the spy! Everyone else wins.', SPYFALL_CHANNEL);
            }
            else {
              rtm.sendMessage('@' + game.spy.name + ' was not the spy!', SPYFALL_CHANNEL);
              rtm.sendMessage('@' + game.spy.name + ' was the spy and they win!', SPYFALL_CHANNEL);
            }
            game = {};
          }
        }
      }
    }
    if (message.text.substr(0, 2) === 'No') {
      if (game.accusationList && game.accused !== messageUser.id) {
        if (game.accusationList.find(messageUser.name) === -1) {
          game.accused = undefined;
          game.accusationList = undefined;
          rtm.sendMessage('The accusation has been dropped.', SPYFALL_CHANNEL);
        }
      }
    }
    // ADD A COMMAND TO GUESS WHERE THE LOCATION IS
    if (message.text.substr(0, 12) === 'spybot guess') {
      var guess = message.text.substr(13);
      console.log('GUESSING')
      console.log(game.spy)
      console.log(messageUser)
      if (messageUser.id === game.spy.id) {
        if (guess === game.location.name) {
          rtm.sendMessage('The spy guessed right! @' + game.spy.name + ' wins', SPYFALL_CHANNEL);
        }
        else {
          rtm.sendMessage('The spy guessed wrong! We are actuallly at a ' + game.location.name + '. Everyone else wins!', SPYFALL_CHANNEL);
        }
        game = {};
      }
    }
  }
});
