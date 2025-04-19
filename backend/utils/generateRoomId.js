// src/utils/generateRoomId.js
module.exports = () => Math.random().toString(36).substring(2, 8).toUpperCase();
