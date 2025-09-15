const axios = require('axios');

async function fetchUserInfo(username) {
  const url = `https://api.roblox.com/users/get-by-username?username=${username}`;
  const response = await axios.get(url, {
    headers: {
      'x-api-key': process.env.ROBLOX_API_KEY
    }
  });
  return response.data;
}

module.exports = {
  fetchUserInfo,
  // Add other API service functions here
};