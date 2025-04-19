// src/models/Room.js
const { Schema, model } = require("mongoose");
const PlayerSchema = require("./Player");

const RoomSchema = new Schema(
  {
    roomId: { type: String, unique: true, required: true },
    players: [PlayerSchema],
    question: { type: String, default: "" },
    answer: { type: String, default: "" },
    started: { type: Boolean, default: false },
    chat: [{ system: Boolean, user: String, text: String }],
  },
  { timestamps: true }
);

module.exports = model("Room", RoomSchema);
