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

function buf2hex(buffer) {
  return Array.prototype.map
    .call(new Uint8Array(buffer), (x, i) => ("00" + x.toString(16)).slice(-2) + (i % 8 == 7 ? " " : ""))
    .join(" ");
}

var data = new Uint8Array(16);
data[0] = 0x7e;
data[3] = 0x01;
data[5] = 0x10;

client.connect(8000, "192.168.88.9", function() {
  console.log("Connected Rover Tank");
  setInterval(function() {
    // data[7] = 0x01;
    // data[9] = 0x01;
    // data[12] = 0x01; // led when move
    // data[11] = 0x00;

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

var header = new Uint8Array(17);
var iHeader = 0;
var data;
var lData = 0;
var iData = 0;
var part = [];
var lPart = 0;
var iPart = 0;

client.on("data", function(chunk) {
  for (let i = 0; i < chunk.length; i++) {
    if (iHeader == 0) {
      // start bit
      if (chunk[i] == 0x7e) {
        header[iHeader] = chunk[i];
        iHeader++;
      } else {
        console.log("Error start", chunk[i], buf2hex(chunk.slice(i - 8, i + 8)));
        return;
      }
    } else if (iHeader <= 7) {
      // indentify ?? and length
      header[iHeader] = chunk[i];
      iHeader++;
    } else if (iHeader == 8) {
      // check sum
      header[iHeader] = chunk[i];
      iHeader++;

      let sum = 0;
      for (let j = 0; j <= 7; j++) {
        sum += header[j];
      }
      sum %= 256;
      if (header[8] != sum) {
        console.log("Error check sum", header[8], sum);
        iHeader = 0;
        return;
      }
      iData = 0;
      lData = (header[7] << 8) | header[6];
      if (lData <= 0) {
        console.log("header", header);
        iHeader = 0;
        return;
      }
      data = new Uint8Array(lData);
    } else if (header[5] == 0x01 && iHeader <= 15) {
      // number of part , part number , identify ??
      header[iHeader] = chunk[i];
      iHeader++;
    } else if (header[5] == 0x01 && iHeader == 16) {
      // identify ??
      header[iHeader] = chunk[i];
      iHeader++;

      lData -= 8;
      data = new Uint8Array(lData);
    } else {
      if (iData < lData) {
        data[iData] = chunk[i];
        iData++;
      }
      if (iData == lData) {
        // console.log(chunk);
        if (header[5] == 0x01) {
          if (header[11] == 0) {
            lPart = header[9];
            iPart = header[11];
            part = [];
            part.push(data);
            iPart++;
          } else if (iPart != header[11]) {
            console.log(buf2hex(header), header[9], "/", header[11], iPart);
          } else {
            part.push(data);
            iPart++;
          }
          if (lPart == iPart) {
            let length = 0;
            for (let j = 0; j < lPart; j++) {
              length += part[j].length;
            }
            // console.log("Fin", length);
            let picarray = new Uint8Array(length);
            let index = 0;
            for (let j = 0; j < lPart; j++) {
              picarray.set(part[j], index);
              index += part[j].length;
            }
            if ((picarray[1] = 0xd9)) {
              picarray[1] = 0xd8;
              picarray[15] = 0x01;
            }
            console.log("**", buf2hex(picarray.slice(0, 48)));
            let base64 = Buffer.from(picarray).toString("base64");
            wss.clients.forEach(function each(client) {
              client.send(base64);
            });
          }
        } else {
          // console.log(buf2hex(header.slice(0, 9)));
          // console.log(data);
        }
        iHeader = 0;
      }
    }
  }
});
