require('dotenv').config();
const { Client, IntentsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
  ],
});

// Load commands dynamically
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

client.once('clientReady', (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}!`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  // Dynamically match and execute commands
  for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    if (command.data.name === commandName) {
      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
      }
    }
  }
});

client.login(process.env.DISCORD_TOKEN);