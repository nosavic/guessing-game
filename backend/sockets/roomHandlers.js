// src/sockets/roomHandlers.js
const {
  createRoom,
  joinRoom,
  setQuestion,
  startGame,
  submitGuess,
  rotateMaster,
  leaveRoom,
} = require("../controllers/roomController");

module.exports = (io, socket) => {
  socket.on("create_room", async ({ nickname }, cb) => {
    try {
      const room = await createRoom(socket.id, nickname);
      socket.join(room.roomId);
      io.to(room.roomId).emit("update_players", room.players);
      io.to(room.roomId).emit("chat_update", room.chat);
      cb({ roomId: room.roomId });
    } catch (err) {
      cb({ error: err.message });
    }
  });

  socket.on("join_room", async ({ roomId, nickname }, cb) => {
    try {
      const room = await joinRoom(roomId, socket.id, nickname);
      socket.join(roomId);
      io.to(roomId).emit("update_players", room.players);
      io.to(roomId).emit("chat_update", room.chat);
      cb({ success: true });
    } catch (err) {
      cb({ error: err.message });
    }
  });

  socket.on("set_question", async (data, cb) => {
    try {
      const room = await setQuestion(
        data.roomId,
        socket.id,
        data.question,
        data.answer
      );
      io.to(data.roomId).emit("chat_update", room.chat);
      cb({ success: true });
    } catch (err) {
      cb({ error: err.message });
    }
  });

  socket.on("start_game", async ({ roomId }, cb) => {
    try {
      const room = await startGame(roomId, socket.id);
      io.to(roomId).emit("game_started", { question: room.question });
      io.to(roomId).emit("chat_update", room.chat);

      // 60s timer to end game if no winner
      setTimeout(async () => {
        const endedRoom = await leaveRoom(roomId, null); // placeholder
        // normally call rotateMaster and emit game_ended here
      }, 60000);

      cb({ success: true });
    } catch (err) {
      cb({ error: err.message });
    }
  });

  socket.on("submit_guess", async ({ roomId, guess }, cb) => {
    try {
      const { room, result } = await submitGuess(roomId, socket.id, guess);
      io.to(roomId).emit("chat_update", room.chat);
      if (result.winner) {
        io.to(roomId).emit("game_won", result);
      }
      cb(result);
    } catch (err) {
      cb({ error: err.message });
    }
  });

  socket.on("disconnect", async () => {
    // For each room the socket was in, remove the player
    const rooms = Array.from(io.sockets.adapter.rooms.keys());
    for (const roomId of rooms) {
      try {
        const room = await leaveRoom(roomId, socket.id);
        if (room) {
          io.to(roomId).emit("update_players", room.players);
          io.to(roomId).emit("chat_update", room.chat);
        }
      } catch {}
    }
  });
};
