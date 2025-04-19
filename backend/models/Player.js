// src/models/Player.js
const { Schema } = require("mongoose");

const PlayerSchema = new Schema({
  id: { type: String, required: true },
  nickname: { type: String, required: true },
  score: { type: Number, default: 0 },
  isMaster: { type: Boolean, default: false },
  attempts: { type: Number, default: 3 },
});

module.exports = PlayerSchema;
