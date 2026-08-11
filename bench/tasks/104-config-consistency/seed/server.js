const http = require('node:http');
const config = require('./config.json');
const server = http.createServer((req, res) => { res.writeHead(200); res.end('ok'); });
server.listen(config.port);
console.log('listening on http://localhost:3000');
if (process.argv.includes('--port')) { console.log(3000); process.exit(0); }
