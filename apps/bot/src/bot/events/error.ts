import { event } from 'bot/util/registry/event.js';
import { Events } from 'discord.js';

export default event(Events.Error, function (error) {
  console.log('Client registered an error', error);
});
