const http = require('node:http');

const server = http.createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200);
    res.end('home');
    return;
  }
  res.writeHead(404);
  res.end('not found');
});

server.listen(process.env.PORT || 3000);
module.exports = server;
