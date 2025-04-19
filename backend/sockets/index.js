// src/sockets/index.js
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
require("../config/db");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.get("/", (req, res) => res.send("Guessing Game Backend is running"));

const roomHandlers = require("./roomHandlers");
io.on("connection", (socket) => {
  console.log(`🖇️ Client connected: ${socket.id}`);
  roomHandlers(io, socket);
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`🚀 Server listening on port ${PORT}`));
