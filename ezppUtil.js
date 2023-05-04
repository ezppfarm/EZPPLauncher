const axios = require('axios').default;

const loginCheckEndpoint = 'https://ez-pp.farm/login/check';

const performLogin = async (username, password) => {
    const result = await axios.post(loginCheckEndpoint, { username, password });
    return result.data;
}

module.exports = { performLogin };