var net = require("net");

var client = new net.Socket();
client.connect(8000, "192.168.88.9", function() {
  console.log("Connected");
  // client.write('Hello, server! Love, Client.');
});

client.on("data", function(data) {
  // console.log('Received: ' + data);
  console.log("Get " + data.length);
  // client.destroy(); // kill client after server's response
});

client.on("close", function() {
  console.log("Connection closed");
});
