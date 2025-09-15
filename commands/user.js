const { SlashCommandBuilder } = require('@discordjs/builders');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('user')
        .setDescription('Fetch user info from Roblox')
        .addStringOption(option =>
            option.setName('userid')
                .setDescription('The user ID of the Roblox user')
                .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply();

        const userId = interaction.options.getString('userid');
        try {
            console.log(`Fetching data for user ID: ${userId}`);

            // Fetch user info using user ID
            const userInfoResponse = await axios.get(`https://users.roblox.com/v1/users/${userId}`);
            console.log('User Info Response Status:', userInfoResponse.status);
            console.log('User Info Response Data:', JSON.stringify(userInfoResponse.data, null, 2));

            const userInfo = userInfoResponse.data;

            const embed = {
                color: 0x0099ff,
                title: 'User Info',
                fields: [
                    { name: 'Username', value: userInfo.name, inline: true },
                    { name: 'User ID', value: userInfo.id.toString(), inline: true },
                    { name: 'Display Name', value: userInfo.displayName, inline: true },
                    { name: 'Profile Link', value: `[Link](https://www.roblox.com/users/${userInfo.id}/profile)`, inline: true },
                ],
            };

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error fetching user data:', JSON.stringify(error.response ? error.response.data : error, null, 2));
            await interaction.editReply(`Failed to fetch user data. Error: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
        }
    },
};
