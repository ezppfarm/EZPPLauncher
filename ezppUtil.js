const axios = require('axios').default;

const loginCheckEndpoint = 'https://ez-pp.farm/login/check';
let retries = 0;

const performLogin = async (username, password) => {
    const result = await axios.post(loginCheckEndpoint, { username, password });
    const code = result.data.code ?? 404;
    if (code === 200 || code === 403) {
        retries = 0;
        return result.data;
    } else {
        if (retries++ >= 5) return { code: 403, message: "Login failed." }
        return await performLogin(username, password);
    }
}

module.exports = { performLogin };