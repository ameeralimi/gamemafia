// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  // فعّل CORS إذا احتجت (اختياري)
  // cors: { origin: "*", methods: ["GET","POST"] }
});

io.use((socket, next) => {
  cookieParser()(socket.request, {}, next);
});

app.use(express.static('public'));
app.use(cookieParser());

// ===================== بيانات اللعبة =====================
const rooms = {};
// structure:
// rooms[roomCode] = {
//   host, mafiaCount, players: [{name,status,id}], started, votes, round, roles, kickedPlayers, showVoteMessages
// }

// ===================== قنوات الصوت (WebRTC Signaling) =====================
// voiceRooms: roomCode => Set<socketId>
const voiceRooms = new Map();
// socketId => roomCode (لتنظيف سريع عند الخروج)
const socketToVoiceRoom = new Map();

function voiceJoin(socket, roomCode) {
  if (!voiceRooms.has(roomCode)) voiceRooms.set(roomCode, new Set());
  const set = voiceRooms.get(roomCode);
  // أرسل للمستخدم الحالي IDs بقية المتواجدين ليبدأ هو الاتصال بهم
  const peers = [...set].filter(id => id !== socket.id);
  socket.emit('voice-peers', { ids: peers });

  // أضف المستخدم للقائمة
  set.add(socket.id);
  socketToVoiceRoom.set(socket.id, roomCode);
}

function voiceLeave(socket) {
  const roomCode = socketToVoiceRoom.get(socket.id);
  if (!roomCode) return;
  const set = voiceRooms.get(roomCode);
  if (set) {
    set.delete(socket.id);
    // أخبر بقية الموجودين أن هذا النظير خرج
    socket.to([...set]).emit('voice-peer-left', { id: socket.id });
    if (set.size === 0) voiceRooms.delete(roomCode);
  }
  socketToVoiceRoom.delete(socket.id);
}

// ===================== Socket.IO =====================
io.on('connection', (socket) => {
  console.log('🔌 مستخدم جديد متصل', socket.id);

  // ===================== لعبة المافيا (كما هي + تحسينات طفيفة) =====================
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
    const player = room.players.find(p => p.name === playerName);
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

  socket.on('chat-message', ({ roomCode, playerName, message }) => {
    io.to(roomCode).emit('chat-message', { playerName, message });
  });

  socket.on('send-gift', ({ roomCode, playerName, gift, target }) => {
    io.to(roomCode).emit('receive-gift', { playerName, gift, target });
  });

  socket.on('start-game', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room || room.started) return;

    room.started = true;
    room.votes = {};
    room.roles = {};
    room.round = 1;

    // خلط Fisher-Yates
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

    mafiaPlayers.forEach(player => {
      room.roles[player.name] = 'mafia';
    });

    shuffled.forEach(player => {
      if (!room.roles[player.name]) {
        room.roles[player.name] = 'citizen';
      }
    });

    room.players.forEach(player => {
      io.to(player.id).emit('game-started', {
        role: room.roles[player.name],
        roomCode,
        round: room.round
      });
    });

    if (room.mafiaCount > 1) {
      const mafiaNames = mafiaPlayers.map(p => p.name);
      mafiaPlayers.forEach(player => {
        io.to(player.id).emit('mafia-list', mafiaNames.filter(name => name !== player.name));
      });
    }
  });

  socket.on('set-vote-messages-visibility', ({ roomCode, show }) => {
    const room = rooms[roomCode];
    if (!room) return;
    room.showVoteMessages = show;
  });

  socket.on('get-mafia', ({ roomCode, playerName }) => {
    const room = rooms[roomCode];
    if (!room || room.roles[playerName] !== 'mafia') return;
    const mafiaPlayers = room.players.filter(p => room.roles[p.name] === 'mafia');
    socket.emit('show-mafia', mafiaPlayers);
  });

  socket.on('vote-player', ({ roomCode, playerName, target }) => {
    const room = rooms[roomCode];
    if (!room) return;
    if (room.kickedPlayers.includes(playerName)) return;

    room.votes[playerName] = target;

    if (room.showVoteMessages) {
      io.to(roomCode).emit('chat-message', {
        playerName: playerName,
        message: `صوت ضد ${target} 🗳️`
      });
    }

    const voteCount = {};
    Object.values(room.votes).forEach(v => {
      voteCount[v] = (voteCount[v] || 0) + 1;
    });

    const result = room.players.map(p => ({
      playerName: p.name,
      count: voteCount[p.name] || 0
    }));
    io.to(roomCode).emit('vote-result', result);

    const votedCount = Object.keys(room.votes).length;
    const totalPlayers = room.players.filter(p => !room.kickedPlayers.includes(p.name)).length;
    io.to(roomCode).emit('update-vote-count', {
      votedCount,
      totalPlayers
    });
  });

  function getPlayerNameFromSocket(socket, roomCode) {
    const room = rooms[roomCode];
    if (!room) return null;
    const player = room.players.find(p => p.id === socket.id);
    return player ? player.name : null;
  }

  socket.on('transfer-host', ({ roomCode, newHost }) => {
    const room = rooms[roomCode];
    if (!room) return;

    const currentHost = getPlayerNameFromSocket(socket, roomCode);
    if (currentHost !== room.host) return;

    room.host = newHost;
    io.to(roomCode).emit('host-transferred', { newHost });

    const targetSocket = Array.from(io.sockets.sockets.values()).find(
      s => getPlayerNameFromSocket(s, roomCode) === newHost
    );
    if (targetSocket) {
      targetSocket.emit('you-are-now-host');
    }
  });

  socket.on('kick-voted-player', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room) return;

    const tally = {};
    Object.values(room.votes).forEach(name => {
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
      const eliminatedPlayer = room.players.find(p => p.name === eliminated);
      const role = room.roles[eliminated];

      if (eliminatedPlayer) {
        io.to(eliminatedPlayer.id).emit('you-have-been-kicked');
        room.kickedPlayers.push(eliminated);
        io.to(roomCode).emit('player-eliminated', { name: eliminated, role });
        room.round++;
        io.to(roomCode).emit('update-round', { round: room.round });
        room.players = room.players.filter(p => p.name !== eliminated);
      }
    }
    room.votes = {};
  });

  socket.on('kick-player', ({ roomCode, playerName }) => {
    const room = rooms[roomCode];
    if (!room) return;
    const index = room.players.findIndex(p => p.name === playerName);
    if (index !== -1) {
      const player = room.players[index];
      io.to(player.id).emit('kicked');
      room.players.splice(index, 1);
      io.to(roomCode).emit('update-players', room.players);
    }
  });

  // ===================== إشارات الصوت (WebRTC) بأسماء تطابق الواجهة =====================
  socket.on('voice-join', ({ roomCode, playerName }) => {
    // الانضمام المنطقي لقناة الصوت (لا يحتاج join() خاص، نستخدم هياكلنا)
    voiceJoin(socket, roomCode);
  });

  // إعادة قائمة الأقران عند الطلب (اختياري)
  socket.on('voice-get-peers', ({ roomCode }) => {
    const set = voiceRooms.get(roomCode) || new Set();
    socket.emit('voice-peers', { ids: [...set].filter(id => id !== socket.id) });
  });

  socket.on('voice-offer', ({ roomCode, to, offer }) => {
    // إعادة توجيه العرض للطرف المقصود
    io.to(to).emit('voice-offer', { from: socket.id, offer });
  });

  socket.on('voice-answer', ({ roomCode, to, answer }) => {
    io.to(to).emit('voice-answer', { from: socket.id, answer });
  });

  socket.on('voice-ice', ({ roomCode, to, candidate }) => {
    io.to(to).emit('voice-ice', { from: socket.id, candidate });
  });

  // ===================== قطع الاتصال =====================
  socket.on('disconnect', () => {
    // تنظيف الصوت أولاً
    voiceLeave(socket);

    // تحديث حالة اللاعب في غرف اللعبة
    for (const code in rooms) {
      const room = rooms[code];
      const player = room.players.find(p => p.id === socket.id);
      if (player) {
        player.status = 'offline';
        io.to(code).emit('update-players', room.players);
        break;
      }
    }
  });
});

// ================ التشغيل ================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 الخادم يعمل على http://localhost:${PORT}`));
