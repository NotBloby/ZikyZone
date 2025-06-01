const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Získání CLIENT_ID a GUILD_ID z .env
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, // Potřebný intent pro práci s guildy
    ]
});

client.once('ready', async () => {
    // Cesta k příkazům
    const commandPath = path.join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandPath).filter(file => file.endsWith('.js'));

    // Vytváření příkazů
    const commands = [];
    for (const file of commandFiles) {
        const command = require(path.join(commandPath, file));
        commands.push(command.data.toJSON());
    }

    // Nasazení příkazů na server
    try {
        await client.application?.commands.set(commands, guildId);  // Použití guildId pro nasazení na konkrétní server
        console.log('✅ Příkazy nasazeny!');
    } catch (error) {
        console.error('❌ Chyba při nasazení příkazů:', error);
    }

    client.destroy(); // Ukončení klienta po nasazení příkazů
});

// Přihlášení do Discord klienta (bez tokenu pro bezpečnost)
client.login(process.env.TOKEN);
