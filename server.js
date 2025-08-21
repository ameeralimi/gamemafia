// server.js
// ===================== الإعدادات الأساسية =====================
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
const server = http.createServer(app);

// ملاحظة: Render يدعم WebSocket؛ نفعّل النقل عبر websocket + السماح بالكورس
const io = new Server(server, {
  transports: ['websocket', 'polling'], // مهم لتمكين WebSocket أولاً ثم fallback
  cors: {
    origin: [
      'https://gamemafia.onrender.com', // نطاقك على Render
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173'
    ],
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingInterval: 25000,
  pingTimeout: 20000
});

// ميدلويرات إكسبريس
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// تقديم الملفات الثابتة من مجلد public
app.use(express.static(path.join(__dirname, 'public')));

// لتجربة سريعة على الجذر
app.get('/health', (_req, res) => res.json({ ok: true }));

// ===================== حالة اللعبة =====================
// rooms: { [roomCode]: { host, mafiaCount, players[], started, votes{}, round, roles{}, kickedPlayers[], showVoteMessages } }
const rooms = {};

// ===================== حالة الصوت (WebRTC Signaling) =====================
// voiceRooms: { [roomCode]: Set<socketId> }
const voiceRooms = new Map();
// socketToVoiceRoom: { [socketId]: roomCode }
const socketToVoiceRoom = {};

// ===================== اتصال Socket.io =====================
io.use((socket, next) => {
  // لو احتجت الكوكيز داخل socket.request
  cookieParser()(socket.request, {}, next);
});

io.on('connection', (socket) => {
  console.log('🔌 مستخدم جديد متصل:', socket.id);

  // ------------- منطق إنشاء الطاولة والانضمام -------------
  socket.on('create-room', ({ playerName, mafiaCount, roomCode }) => {
    socket.join(roomCode);

    if (!rooms[roomCode]) {
      rooms[roomCode] = {
        host: null,
        mafiaCount,
        players: [],
        started: false,
        votes: {},
        round: 1,
        roles: {},
        kickedPlayers: [],
        showVoteMessages: true
      };
    }

    if (!rooms[roomCode].host) {
      rooms[roomCode].host = playerName;
    }

    rooms[roomCode].players.push({ name: playerName, status: 'online', id: socket.id });

    io.to(roomCode).emit('update-players', rooms[roomCode].players);
  });

  socket.on('join-room', ({ playerName, roomCode }) => {
    if (!rooms[roomCode]) return;
    socket.join(roomCode);
    rooms[roomCode].players.push({ name: playerName, status: 'online', id: socket.id });
    io.to(roomCode).emit('update-players', rooms[roomCode].players);
  });

  socket.on('player-join-room', ({ playerName, roomCode }) => {
    const room = rooms[roomCode];
    if (!room) return;
    const player = room.players.find((p) => p.name === playerName);
    if (player) {
      player.status = 'online';
      player.id = socket.id;
      socket.join(roomCode);
      io.to(roomCode).emit('update-players', room.players);
    } else {
      socket.emit('redirect', { to: 'index.html' });
    }
  });

  socket.on('get-rooms-info', () => {
    const roomsInfo = Object.entries(rooms).map(([code, room]) => ({
      roomCode: code,
      playerCount: room.players.length,
      started: room.started
    }));
    socket.emit('rooms-info', roomsInfo);
  });

  // ------------- الدردشة والهدايا -------------
  socket.on('chat-message', ({ roomCode, playerName, message }) => {
    io.to(roomCode).emit('chat-message', { playerName, message });
  });

  socket.on('send-gift', ({ roomCode, playerName, gift, target }) => {
    io.to(roomCode).emit('receive-gift', { playerName, gift, target });
  });

  // ------------- بدء اللعبة وتوزيع الأدوار -------------
  socket.on('start-game', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room || room.started) return;

    room.started = true;
    room.votes = {};
    room.roles = {};
    room.round = 1;

    function shuffle(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    }

    const playersCopy = [...room.players];
    const shuffled = shuffle(playersCopy);

    const mafiaPlayers = shuffled.slice(0, room.mafiaCount);

    mafiaPlayers.forEach((player) => {
      room.roles[player.name] = 'mafia';
    });

    shuffled.forEach((player) => {
      if (!room.roles[player.name]) {
        room.roles[player.name] = 'citizen';
      }
    });

    room.players.forEach((player) => {
      io.to(player.id).emit('game-started', {
        role: room.roles[player.name],
        roomCode,
        round: room.round
      });
    });

    if (room.mafiaCount > 1) {
      const mafiaNames = mafiaPlayers.map((p) => p.name);
      mafiaPlayers.forEach((player) => {
        io.to(player.id).emit('mafia-list', mafiaNames.filter((name) => name !== player.name));
      });
    }
  });

  // ------------- إظهار/إخفاء رسائل التصويت في الدردشة -------------
  socket.on('set-vote-messages-visibility', ({ roomCode, show }) => {
    const room = rooms[roomCode];
    if (!room) return;
    room.showVoteMessages = show;
  });

  // ------------- طلب قائمة المافيا (للاعب المافيا فقط) -------------
  socket.on('get-mafia', ({ roomCode, playerName }) => {
    const room = rooms[roomCode];
    if (!room || room.roles[playerName] !== 'mafia') return;
    const mafiaPlayers = room.players.filter((p) => room.roles[p.name] === 'mafia');
    socket.emit('show-mafia', mafiaPlayers);
  });

  // ------------- التصويت -------------
  socket.on('vote-player', ({ roomCode, playerName, target }) => {
    const room = rooms[roomCode];
    if (!room) return;
    if (room.kickedPlayers.includes(playerName)) return; // المطرود لا يصوّت

    room.votes[playerName] = target;

    if (room.showVoteMessages) {
      io.to(roomCode).emit('chat-message', {
        playerName: playerName,
        message: `صوت ضد ${target} 🗳️`
      });
    }

    const voteCount = {};
    Object.values(room.votes).forEach((v) => {
      voteCount[v] = (voteCount[v] || 0) + 1;
    });

    const result = room.players.map((p) => ({
      playerName: p.name,
      count: voteCount[p.name] || 0
    }));
    io.to(roomCode).emit('vote-result', result);

    const votedCount = Object.keys(room.votes).length;
    const totalPlayers = room.players.filter((p) => !room.kickedPlayers.includes(p.name)).length;
    io.to(roomCode).emit('update-vote-count', { votedCount, totalPlayers });
  });

  // ------------- إنهاء جولة بإقصاء الأكثر تصويتاً -------------
  socket.on('kick-voted-player', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room) return;

    const tally = {};
    Object.values(room.votes).forEach((name) => {
      tally[name] = (tally[name] || 0) + 1;
    });

    const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) {
      io.to(roomCode).emit('vote-tie', { message: 'لا يوجد تصويتات.' });
      return;
    }

    const topCount = sorted[0][1];
    const topPlayers = sorted.filter(([_, count]) => count === topCount);

    if (topPlayers.length > 1) {
      io.to(roomCode).emit('vote-tie', { message: '❗ تم تساوي الأصوات، لم يتم إقصاء أي لاعب' });
    } else {
      const eliminated = topPlayers[0][0];
      const eliminatedPlayer = room.players.find((p) => p.name === eliminated);
      const role = room.roles[eliminated];

      if (eliminatedPlayer) {
        io.to(eliminatedPlayer.id).emit('you-have-been-kicked');
        room.kickedPlayers.push(eliminated);
        io.to(roomCode).emit('player-eliminated', { name: eliminated, role });
        room.round++;
        io.to(roomCode).emit('update-round', { round: room.round });
        room.players = room.players.filter((p) => p.name !== eliminated);
      }
    }
    room.votes = {};
  });

  // ------------- طرد لاعب يدوياً (من المضيف) -------------
  socket.on('kick-player', ({ roomCode, playerName }) => {
    const room = rooms[roomCode];
    if (!room) return;
    const index = room.players.findIndex((p) => p.name === playerName);
    if (index !== -1) {
      const player = room.players[index];
      io.to(player.id).emit('kicked');
      room.players.splice(index, 1);
      io.to(roomCode).emit('update-players', room.players);
    }
  });

  // ------------- نقل استضافة الطاولة -------------
  function getPlayerNameFromSocket(socket, roomCode) {
    const room = rooms[roomCode];
    if (!room) return null;
    const player = room.players.find((p) => p.id === socket.id);
    return player ? player.name : null;
  }

  socket.on('transfer-host', ({ roomCode, newHost }) => {
    const room = rooms[roomCode];
    if (!room) return;

    const currentHost = getPlayerNameFromSocket(socket, roomCode);
    if (currentHost !== room.host) return; // فقط المضيف ينقل الاستضافة

    room.host = newHost;

    io.to(roomCode).emit('host-transferred', { newHost });

    const targetSocket = [...io.of('/').sockets.values()].find(
      (s) => getPlayerNameFromSocket(s, roomCode) === newHost
    );
    if (targetSocket) {
      targetSocket.emit('you-are-now-host');
    }
  });

  // ===================== إشارات الصوت (WebRTC Signaling) =====================
  // انضمام قناة الصوت
   // ======= إشارات الصوت (WebRTC Signaling) =======
  socket.on("voice-join", ({ roomCode, playerName }) => {
    socket.join(roomCode);
    socket.roomCode = roomCode;
    socket.playerName = playerName;

    // أرسل للمستخدم الجديد قائمة الموجودين (غير نفسه)
    const ids = [...(io.sockets.adapter.rooms.get(roomCode) || [])].filter(id => id !== socket.id);
    socket.emit("voice-peers", { ids });

    // أبلغ الموجودين بوجود مستخدم جديد
    socket.to(roomCode).emit("voice-peer-joined", { id: socket.id, name: playerName });

    // ✅ أبلغ كل الموجودين في الغرفة (عدا الجديد) أنهم يعيدوا الاتصال مع بعض
    socket.to(roomCode).emit("voice-reconnect", { ids: [...(io.sockets.adapter.rooms.get(roomCode) || [])] });
  });


  socket.on("voice-offer", ({ roomCode, to, offer }) => {
    io.to(to).emit("voice-offer", { from: socket.id, offer });
  });

  socket.on("voice-answer", ({ roomCode, to, answer }) => {
    io.to(to).emit("voice-answer", { from: socket.id, answer });
  });

  socket.on("voice-ice", ({ roomCode, to, candidate }) => {
    io.to(to).emit("voice-ice", { from: socket.id, candidate });
  });

  // socket.on("disconnect", () => {
  //   if (socket.roomCode) {
  //     io.to(socket.roomCode).emit("voice-peer-left", { id: socket.id });
  //   }
  //   console.log("❌ مستخدم غادر:", socket.id);
  // });





  // ترك قناة الصوت (اختياري)
  socket.on('voice-leave', () => {
    const roomCode = socketToVoiceRoom[socket.id];
    if (!roomCode) return;
    if (voiceRooms[roomCode]) {
      voiceRooms[roomCode].delete(socket.id);
      // أبلغ البقية أن هذا النظير خرج
      for (const peerId of voiceRooms[roomCode]) {
        io.to(peerId).emit('voice-peer-left', { id: socket.id });
      }
      if (voiceRooms[roomCode].size === 0) delete voiceRooms[roomCode];
    }
    delete socketToVoiceRoom[socket.id];
  });


  

  

  // ------------- قطع الاتصال -------------
  socket.on('disconnect', () => {
    // تحديث حالة اللاعب في غرف اللعبة
    for (const code in rooms) {
      const room = rooms[code];
      const player = room.players.find((p) => p.id === socket.id);
      if (player) {
        player.status = 'offline';
        io.to(code).emit('update-players', room.players);
        break;
      }
    }

    if (socket.roomCode) {
      io.to(socket.roomCode).emit("voice-peer-left", { id: socket.id });
    }
    // إخراج من قناة الصوت وإبلاغ الأقران
    const roomCode = socketToVoiceRoom[socket.id];
    if (roomCode && voiceRooms[roomCode]) {
      voiceRooms[roomCode].delete(socket.id);
      for (const peerId of voiceRooms[roomCode]) {
        io.to(peerId).emit('voice-peer-left', { id: socket.id });
      }
      if (voiceRooms[roomCode].size === 0) delete voiceRooms[roomCode];
    }
    delete socketToVoiceRoom[socket.id];

    console.log('🔌 مستخدم قطع الاتصال:', socket.id);
  });
});

// ===================== تشغيل الخادم =====================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 الخادم يعمل على http://localhost:${PORT}`);
  console.log(`🛰️  Socket.io transports: websocket + polling (ready)`);
});
