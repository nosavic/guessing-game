// backend/server.js
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 4000;
const rooms = {}; // In-memory store for simplicity

io.on("connection", (socket) => {
  console.log(`✔️  ${socket.id} connected`);

  // --- Create Room ---
  socket.on("create_room", ({ nickname }, cb) => {
    const roomId = Math.random().toString(36).substr(2, 6).toUpperCase();
    rooms[roomId] = {
      players: [{ id: socket.id, nickname, score: 0, isMaster: true }],
      question: "",
      answer: "",
      started: false,
      timer: null,
      chat: [],
    };
    socket.join(roomId);
    rooms[roomId].chat.push({
      system: true,
      text: `${nickname} created the room.`,
    });
    io.to(roomId).emit("update_players", rooms[roomId].players);
    io.to(roomId).emit("chat_update", rooms[roomId].chat);
    cb({ roomId });
  });

  // --- Join Room ---
  socket.on("join_room", ({ roomId, nickname }, cb) => {
    const room = rooms[roomId];
    if (!room) return cb({ error: "Room not found." });
    if (room.started) return cb({ error: "Game already in progress." });
    room.players.push({ id: socket.id, nickname, score: 0, isMaster: false });
    socket.join(roomId);
    room.chat.push({ system: true, text: `${nickname} joined the room.` });
    io.to(roomId).emit("update_players", room.players);
    io.to(roomId).emit("chat_update", room.chat);
    cb({ success: true });
  });

  // --- Set Question & Answer (Master only) ---
  socket.on("set_question", ({ roomId, question, answer }) => {
    const room = rooms[roomId];
    if (!room) return;
    const me = room.players.find((p) => p.id === socket.id);
    if (!me || !me.isMaster) return;
    room.question = question;
    room.answer = answer.toLowerCase();
    room.chat.push({ system: true, text: `Master set a new question.` });
    io.to(roomId).emit("chat_update", room.chat);
  });

  // --- Start Game (Master only) ---
  socket.on("start_game", ({ roomId }, cb) => {
    const room = rooms[roomId];
    if (!room) return cb({ error: "Room not found." });
    if (room.players.length < 3)
      return cb({ error: "Need at least 3 players." });
    const me = room.players.find((p) => p.id === socket.id);
    if (!me || !me.isMaster) return cb({ error: "Not authorized." });

    room.started = true;
    room.chat.push({
      system: true,
      text: `Game started! Question: ${room.question}`,
    });
    io.to(roomId).emit("game_started", { question: room.question });
    io.to(roomId).emit("chat_update", room.chat);

    // 60-second timeout
    room.timer = setTimeout(() => {
      room.started = false;
      room.chat.push({
        system: true,
        text: `⏰ Time's up! Answer: ${room.answer}`,
      });
      io.to(roomId).emit("game_ended", { answer: room.answer });
      io.to(roomId).emit("chat_update", room.chat);
      rotateMaster(roomId);
    }, 600000);

    cb({ success: true });
  });

  // --- Submit Guess ---
  socket.on("submit_guess", ({ roomId, guess }, cb) => {
    const room = rooms[roomId];
    if (!room || !room.started) return;
    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;
    player.attempts = player.attempts == null ? 3 : player.attempts;
    if (player.attempts === 0) {
      return cb({ correct: false, attemptsLeft: 0 });
    }

    player.attempts--;
    room.chat.push({
      user: player.nickname,
      text: `guessed: "${guess}"`,
    });
    io.to(roomId).emit("chat_update", room.chat);

    if (guess.toLowerCase() === room.answer) {
      clearTimeout(room.timer);
      room.started = false;
      player.score += 10;
      room.chat.push({
        system: true,
        text: `${player.nickname} guessed correctly and won!`,
      });
      io.to(roomId).emit("game_won", {
        winner: player.nickname,
        answer: room.answer,
        scores: room.players.map((p) => ({ name: p.nickname, score: p.score })),
      });
      io.to(roomId).emit("chat_update", room.chat);
      rotateMaster(roomId);
    } else {
      cb({ correct: false, attemptsLeft: player.attempts });
    }
  });

  // --- Disconnect / Leave ---
  socket.on("disconnect", () => {
    for (const [roomId, room] of Object.entries(rooms)) {
      const idx = room.players.findIndex((p) => p.id === socket.id);
      if (idx !== -1) {
        const [left] = room.players.splice(idx, 1);
        room.chat.push({
          system: true,
          text: `${left.nickname} left the room.`,
        });
        if (room.players.length === 0) {
          delete rooms[roomId];
        } else {
          io.to(roomId).emit("update_players", room.players);
          io.to(roomId).emit("chat_update", room.chat);
        }
      }
    }
  });
});

// Rotate game master
function rotateMaster(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  const idx = room.players.findIndex((p) => p.isMaster);
  room.players[idx].isMaster = false;
  const next = (idx + 1) % room.players.length;
  room.players[next].isMaster = true;
  room.chat.push({
    system: true,
    text: `${room.players[next].nickname} is the new Master.`,
  });
  io.to(roomId).emit("update_players", room.players);
  io.to(roomId).emit("chat_update", room.chat);
}

server.listen(PORT, () =>
  console.log(`🚀 Backend running on http://localhost:${PORT}`)
);
// To run the server, use the command: node server.js

// require("dotenv").config();
// const server = require("./sockets/index.js");
