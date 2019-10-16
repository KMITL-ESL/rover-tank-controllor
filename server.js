const net = require("net");
const http = require("http");
const static = require("node-static");
const WebSocket = require("ws");

const client = new net.Socket();
const file = new static.Server("./static/");
const server = http.createServer((req, res) => {
  req.addListener("end", () => file.serve(req, res)).resume();
});
const wss = new WebSocket.Server({ noServer: true });

server.listen(8080, function() {
  console.log(`Server running at http://localhost:8080`);
});

var data = new Uint8Array(16);
data[0] = 0x7e;
data[3] = 0x01;
data[5] = 0x10;

client.connect(8000, "192.168.88.9", function() {
  console.log("Connected Rover Tank");
  setInterval(function() {
    data[7] = 0x01;
    data[9] = 0x01;
    // data[12] = 0x01; // led when move
    data[11] = 0x01;

    data[1] += 1;
    data[2] += data[1] == 0 ? 1 : 0;
    data[15] = 0;
    for (i = 0; i < 15; i++) {
      data[15] += data[i];
    }
    client.write(data);
  }, 100);
});

server.on("upgrade", (request, socket, head) => {
  // Make sure that we only handle WebSocket upgrade requests
  if (request.headers["upgrade"] !== "websocket") {
    socket.end("HTTP/1.1 400 Bad Request");
    return;
  }

  wss.handleUpgrade(request, socket, head, function done(ws) {
    wss.emit("connection", ws, request);
  });
  // More to come…
});

wss.on("connection", function connection(ws) {
  ws.on("message", function incoming(message) {
    console.log("received: %s", message);
    ws.send("--received: " + message);
  });

  // ws.send("something");
});

client.on("data", function(data) {
  // console.log('Received: ' + data);
});
