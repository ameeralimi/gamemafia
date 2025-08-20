const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = 3000;

let rooms = {};

io.on("connection", (socket) => {
  console.log("User connected: " + socket.id);

  socket.on("create-room", (roomId, playerName) => {
    rooms[roomId] = {
      players: [{ id: socket.id, name: playerName, role: null, alive: true }],
    };
    socket.join(roomId);
    io.to(roomId).emit("update-room", rooms[roomId].players);
  });

  socket.on("join-room", (roomId, playerName) => {
    if (rooms[roomId]) {
      rooms[roomId].players.push({ id: socket.id, name: playerName, role: null, alive: true });
      socket.join(roomId);
      io.to(roomId).emit("update-room", rooms[roomId].players);
    }
  });

  socket.on("start-game", (roomId) => {
    const roles = assignRoles(rooms[roomId].players.length);
    rooms[roomId].players = rooms[roomId].players.map((player, i) => ({
      ...player,
      role: roles[i],
    }));
    rooms[roomId].players.forEach((player) => {
      io.to(player.id).emit("role-assigned", player.role);
    });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected: " + socket.id);
    for (const roomId in rooms) {
      rooms[roomId].players = rooms[roomId].players.filter((p) => p.id !== socket.id);
      io.to(roomId).emit("update-room", rooms[roomId].players);
    }
  });
});

function assignRoles(playerCount) {
  const roles = ["mafia", "doctor", "detective"];
  while (roles.length < playerCount) roles.push("civilian");
  return shuffle(roles);
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

server.listen(PORT, () => console.log("Server listening on http://localhost:" + PORT));