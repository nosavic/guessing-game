// src/controllers/roomController.js

const Room = require("../models/Room");
const generateRoomId = require("../utils/generateRoomId");

async function createRoom(socketId, nickname) {
  const roomId = generateRoomId();
  const room = new Room({
    roomId,
    players: [{ id: socketId, nickname, isMaster: true }],
    started: false,
    chat: [{ system: true, text: `${nickname} created the room.` }],
  });
  await room.save();
  return room;
}

async function joinRoom(roomId, socketId, nickname) {
  const room = await Room.findOne({ roomId });
  if (!room) throw new Error("Room not found");
  if (room.started) throw new Error("Game already in progress");
  room.players.push({ id: socketId, nickname, score: 0, isMaster: false });
  room.chat.push({ system: true, text: `${nickname} joined the room.` });
  await room.save();
  return room;
}

async function setQuestion(roomId, socketId, question, answer) {
  const room = await Room.findOne({ roomId });
  const me = room.players.find((p) => p.id === socketId);
  if (!me || !me.isMaster) throw new Error("Not authorized");
  room.question = question;
  room.answer = answer.toLowerCase();
  room.chat.push({ system: true, text: `Master set a new question.` });
  await room.save();
  return room;
}

async function startGame(roomId, socketId) {
  const room = await Room.findOne({ roomId });
  const me = room.players.find((p) => p.id === socketId);
  if (!me || !me.isMaster) throw new Error("Not authorized");
  if (room.players.length < 3) throw new Error("Need at least 3 players");
  room.started = true;
  room.chat.push({
    system: true,
    text: `Game started! Question: ${room.question}`,
  });
  await room.save();
  return room;
}

async function submitGuess(roomId, socketId, guess) {
  const room = await Room.findOne({ roomId });
  if (!room || !room.started) throw new Error("Game not running");
  const player = room.players.find((p) => p.id === socketId);
  if (!player) throw new Error("Player not in room");
  if (player.attempts === 0) return { attemptsLeft: 0 };

  player.attempts--;
  room.chat.push({ user: player.nickname, text: `guessed: "${guess}"` });

  let result;
  if (guess.toLowerCase() === room.answer) {
    player.score += 10;
    room.started = false;
    result = {
      winner: player.nickname,
      answer: room.answer,
      scores: room.players.map((p) => ({ name: p.nickname, score: p.score })),
    };
  } else {
    result = { correct: false, attemptsLeft: player.attempts };
  }

  await room.save();
  return { room, result };
}

async function rotateMaster(roomId) {
  const room = await Room.findOne({ roomId });
  const idx = room.players.findIndex((p) => p.isMaster);
  room.players[idx].isMaster = false;
  const next = (idx + 1) % room.players.length;
  room.players[next].isMaster = true;
  room.chat.push({
    system: true,
    text: `${room.players[next].nickname} is the new Master.`,
  });
  await room.save();
  return room;
}

async function leaveRoom(roomId, socketId) {
  const room = await Room.findOne({ roomId });
  if (!room) return null;
  const idx = room.players.findIndex((p) => p.id === socketId);
  if (idx !== -1) {
    const [left] = room.players.splice(idx, 1);
    room.chat.push({ system: true, text: `${left.nickname} left the room.` });
    if (room.players.length === 0) {
      await room.deleteOne();
      return null;
    }
    await room.save();
    return room;
  }
  return room;
}

module.exports = {
  createRoom,
  joinRoom,
  setQuestion,
  startGame,
  submitGuess,
  rotateMaster,
  leaveRoom,
};
