const { createServer } = require('node:http');
const server = createServer((req, res) => res.end('ok'));
server.listen(0, () => console.log('listening'));
