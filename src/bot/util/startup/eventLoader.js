const fs = require('fs');
const path = require('path');

const botDir = path.resolve(path.join(__dirname, '..', '..'));
const eventDir = path.join(botDir, 'events');

const files = fs.readdirSync(eventDir).filter((file) => file.endsWith('.js'));

module.exports = (client) => {
  for (const file of files) {
    const event = require(path.join(eventDir, file));

    if (event.once) {
      client.once(event.name, genHandler(event.name, event.execute));
    } else {
      client.on(event.name, genHandler(event.name, event.execute));
    }
  }

  function genHandler(name, execute) {
    return async (...args) => {
      try {
        await execute(...args);
      } catch (err) {
        client.logger.warn({ err, args, name }, 'Error in listener');
      }
    };
  }
};
