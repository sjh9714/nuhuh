const api = require('./api.js');
const handler = 'fetchUser';
console.log(api[handler]().name);
