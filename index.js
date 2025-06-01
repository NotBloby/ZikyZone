/* BlobyCZ, ©️, 2025 */
/* spouštění Index.js */
/* https://github.com/NotBloby/Ziky */

require('dotenv').config();

// Debugging pro token
console.log('=== DEBUGGING INFORMACE ===');
console.log('Token loaded:', process.env.DISCORD_TOKEN ? 'ANO (délka: ' + process.env.DISCORD_TOKEN.length + ')' : 'NE');
console.log('Token začíná:', process.env.DISCORD_TOKEN ? process.env.DISCORD_TOKEN.substring(0, 10) + '...' : 'N/A');
console.log('Client ID:', process.env.CLIENT_ID ? 'ANO' : 'NE');
console.log('Guild ID:', process.env.GUILD_ID ? 'ANO' : 'NE');
console.log('=============================');

require('./deploy-commands');

const { Client, GatewayIntentBits, Collection, Partials, Routes, EmbedBuilder } = require('discord.js');
const { REST } = require('@discordjs/rest');
const fs = require('fs');
const path = require('path');

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
const TicketManager = require('./manager/ticket');
const { checkForNewVideos } = require('./manager/yt');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction
  ]
});

const ticketManager = new TicketManager(client, process.env.DISCORD_TOKEN);

const STATUS = process.env.STATUS_CHANNEL_ID;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const WELCOME = process.env.WELCOME_CHANNEL_ID;

client.commands = new Collection();

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
  }
}

async function registerCommands() {
  const commands = [];
  for (const command of client.commands.values()) {
    commands.push(command.data.toJSON());
  }

  try {
    console.log(`🔄 Registruji ${commands.length} příkazů...`);
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log('✅ Slash příkazy zaregistrovány.');
  } catch (error) {
    console.error('❌ Chyba při registraci příkazů:', error);
  }
}

// Vylepšené error handling pro login
client.on('error', error => {
  console.error('[CHYBA] Discord client error:', error);
});

client.on('warn', warn => {
  console.warn('[VAROVÁNÍ]', warn);
});

client.on('debug', info => {
  // Zakomentujte pokud je moc verbose
  // console.log('[DEBUG]', info);
});

console.log('Token:', process.env.DISCORD_TOKEN ? '[načten]' : '[nenačten]');

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.log(`Příkaz ${interaction.commandName} není registrován.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error('Chyba při vykonání příkazu:', error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: 'Nastala chyba při vykonávání příkazu!', ephemeral: true });
    } else {
      await interaction.reply({ content: 'Nastala chyba při vykonávání příkazu!', ephemeral: true });
    }
  }
});

client.events = new Collection();
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);

    client.events.set(event.name, event);

    if (event.once) {
      client.once(event.name, (...args) => event.execute(client, ...args));
    } else {
      client.on(event.name, (...args) => event.execute(client, ...args));
    }
  }
}

const CountingManager = require('./manager/counting.js');
const countingManager = new CountingManager();

client.on('messageCreate', async (message) => {
  await countingManager.handleMessage(message);
});

client.on('messageUpdate', (oldMessage, newMessage) => {
  const event = client.events.get('messageUpdate');
  if (event) {
    event.execute(client, oldMessage, newMessage);
  }
});

client.once('ready', async () => {
  console.log(`[INFO] Bot ${client.user.tag} je připraven!`);
  console.log(`[INFO] Připojen na ${client.guilds.cache.size} serverech`);

  client.user.setActivity('fellas', { type: 'WATCHING' });

  try {
    await registerCommands();
  } catch (error) {
    console.error('[CHYBA] Při registraci příkazů:', error);
  }

  try {
    await ticketManager.setupTicketSystem();
  } catch (error) {
    console.error('[CHYBA] Při nastavování ticket systému:', error);
  }

  try {
    await checkForNewVideos(client);
  } catch (error) {
    console.error('[CHYBA] Při kontrole nových videí:', error);
  }

  setInterval(async () => {
    try {
      await checkForNewVideos(client);
    } catch (error) {
      console.error('[CHYBA] Při kontrole nových videí:', error);
    }
  }, 300000);

  if (!STATUS) {
    console.log('[UPOZORNĚNÍ] STATUS_CHANNEL_ID není nastaveno v .env, zpráva se neodešle.');
    return;
  }

  const guild = client.guilds.cache.first();

  if (!guild) {
    console.log('[UPOZORNĚNÍ] Bot není připojen k žádnému serveru.');
    return;
  }

  try {
    await channel.send(`🤖 Načteno příkazů: **${client.commands.size}**`);
    console.log('[INFO] Zpráva o načtených příkazech odeslána.');
  } catch (error) {
    console.error('[CHYBA] Při odesílání zprávy do kanálu:', error);
  }
});

function vytvorit(member) {
  return new EmbedBuilder()
    .setColor('#00ff88')
    .setTitle(`<:wave:1376206483049549834> Vítej na serveru`)
    .setDescription(`**${member.user.username}** se právě připojil k naší komunitě!`)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .addFields(
      { name: '👤 Uživatel', value: `<@${member.id}>`, inline: false },
      { name: '📅 Účet vytvořen', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: false },
      { name: '👥 Jsi člen číslo', value: `**${member.guild.memberCount}**`, inline: false }
    )
    .setFooter({
      text: `${member.guild.name} • Užij si pobyt!`,
      iconURL: member.guild.iconURL({ dynamic: true })
    })
    .setTimestamp();
}

function opustit(member) {
  return new EmbedBuilder()
    .setColor('#ff4757')
    .setTitle(`<a:peace:1376206789388927077> Někdo nás opustil`)
    .setDescription(`**${member.user.username}** opustil server`)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .addFields(
      { name: '👤 Uživatel', value: `${member.user.tag}`, inline: true },
      { name: '⏰ Byl s námi', value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Neznámé', inline: true },
      { name: '👥 Zůstává nás', value: `**${member.guild.memberCount}**`, inline: true }
    )
    .setFooter({
      text: `${member.guild.name} • Snad se ještě vrátí`,
      iconURL: member.guild.iconURL({ dynamic: true })
    })
    .setTimestamp();
}

client.on('guildMemberAdd', async (member) => {
  if (!WELCOME) {
    console.warn('[UPOZORNĚNÍ] WELCOME není nastaveno v environment variables');
    return;
  }

  const kanal = member.guild.channels.cache.get(WELCOME);
  if (!kanal || !kanal.send) {
    console.error('[CHYBA] Vítací kanál nebyl nalezen nebo bot nemá přístup');
    return;
  }

  const embed = vytvorit(member);
  try {
    await kanal.send({ content: `<@${member.id}> Vítej! 🎊`, embeds: [embed] });
    console.log(`[INFO] Vítací zpráva odeslána pro uživatele ${member.user.tag}`);
  } catch (error) {
    if (error.code === 50013) {
      console.error('[CHYBA] Bot nemá oprávnění posílat zprávy do vítacího kanálu.');
    } else {
      console.error('[CHYBA] Při odesílání vítací zprávy:', error);
    }
  }
});

client.on('guildMemberRemove', async (member) => {
  if (!WELCOME) {
    console.warn('[UPOZORNĚNÍ] WELCOME není nastaveno v environment variables');
    return;
  }

  const kanal = member.guild.channels.cache.get(WELCOME);
  if (!kanal || !kanal.send) {
    console.error('[CHYBA] Odchodový kanál nebyl nalezen nebo bot nemá přístup');
    return;
  }

  const embed = opustit(member);
  try {
    await kanal.send({ embeds: [embed] });
    console.log(`[INFO] Odchodová zpráva odeslána pro uživatele ${member.user.tag}`);
  } catch (error) {
    if (error.code === 50013) {
      console.error('[CHYBA] Bot nemá oprávnění posílat zprávy do odchodového kanálu.');
    } else {
      console.error('[CHYBA] Při odesílání odchodové zprávy:', error);
    }
  }
});

process.on('unhandledRejection', error => {
  console.error('[CHYBA] Unhandled promise rejection:', error);
});

// Vylepšený login s error handling
client.login(process.env.DISCORD_TOKEN)
  .then(() => {
    console.log('[SUCCESS] Bot se úspěšně připojil!');
  })
  .catch(error => {
    console.error('[KRITICKÁ CHYBA] Nepodařilo se připojit k Discordu:');
    console.error('Typ chyby:', error.name);
    console.error('Zpráva:', error.message);
    
    if (error.code === 'TokenInvalid') {
      console.error('🔧 ŘEŠENÍ:');
      console.error('1. Zkontrolujte, že token v .env je správný');
      console.error('2. Vygenerujte nový token na https://discord.com/developers/applications');
      console.error('3. Ujistěte se, že token začíná MTxxxxx nebo podobně');
      console.error('4. Zkontrolujte, že .env soubor je ve správné složce');
    }
    
    process.exit(1);
  });