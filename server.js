// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

io.use((socket, next) => {
  cookieParser()(socket.request, {}, next);
});

app.use(express.static('public'));
app.use(cookieParser());

const rooms = {}; 
// roomCode: { host, mafiaCount, players, started, votes, round, roles }

io.on('connection', (socket) => {
  console.log('🔌 مستخدم جديد متصل');

  socket.on('create-room', ({ playerName, mafiaCount, roomCode }) => {
      socket.join(roomCode);

      // إذا لم تكن الغرفة موجودة، قم بإنشائها مع بياناتها
      if (!rooms[roomCode]) {
          rooms[roomCode] = {
              host: null,  // لا يوجد رئيسي مبدئيًا
              mafiaCount,
              players: [],
              started: false,
              votes: {},
              round: 1,
              roles: {},
              kickedPlayers: [],
              showVoteMessages: true // ✅ هذا هو السطر المضاف
          };
      }

      // إذا لم يكن هناك رئيسي، يتم تعيين اللاعب الحالي كـ رئيسي
      if (!rooms[roomCode].host) {
          rooms[roomCode].host = playerName;
      }

      // إضافة اللاعب إلى قائمة اللاعبين
      rooms[roomCode].players.push({ name: playerName, status: 'online', id: socket.id });

      // إرسال التحديث لجميع اللاعبين في الغرفة
      io.to(roomCode).emit('update-players', rooms[roomCode].players);
  });


  // خاص بالمايك والسماعة
  socket.on("offer", async ({ from, offer }) => {
    const peer = createPeerConnection(from);
    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    socket.emit("answer", { to: from, answer });
  });
  socket.on("answer", async ({ from, answer }) => {
    const peer = peers[from];
    await peer.setRemoteDescription(new RTCSessionDescription(answer));
  });
  socket.on("ice-candidate", ({ from, candidate }) => {
    const peer = peers[from];
    if (peer) peer.addIceCandidate(new RTCIceCandidate(candidate));
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

    // ✅ دالة خلط عشوائي قوية (Fisher-Yates)
    function shuffle(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    }

    // 🔁 نأخذ نسخة من اللاعبين ونخلطها
    const playersCopy = [...room.players];
    const shuffled = shuffle(playersCopy); // خلط كامل

    // 👤 اختيار المافيا بناءً على العدد المطلوب فقط من اللاعبين المخلوطين
    const mafiaPlayers = shuffled.slice(0, room.mafiaCount);

    // 🟥 تعيين دور المافيا
    mafiaPlayers.forEach(player => {
      room.roles[player.name] = 'mafia';
    });

    // 🟦 تعيين البقية كمواطنين
    shuffled.forEach(player => {
      if (!room.roles[player.name]) {
        room.roles[player.name] = 'citizen';
      }
    });

    // 🎮 إرسال الدور لكل لاعب
    room.players.forEach(player => {
      io.to(player.id).emit('game-started', {
        role: room.roles[player.name],
        roomCode,
        round: room.round
      });
    });


    // 📣 إذا أكثر من مافيا، يعرفوا بعضهم
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
    if (room.kickedPlayers.includes(playerName)) return; // لا يمكن للمطرود التصويت

    room.votes[playerName] = target;

    // 🟨 إرسال رسالة إلى الدردشة عند التصويت
    if (room.showVoteMessages) {
      io.to(roomCode).emit('chat-message', {
        playerName: playerName,
        message: `صوت ضد ${target} 🗳️`
      });
    }

    // 🟧 عد عدد الأصوات لكل لاعب
    const voteCount = {};
    Object.values(room.votes).forEach(v => {
      voteCount[v] = (voteCount[v] || 0) + 1;
    });

    // 🟦 إرسال عدد الأصوات لكل لاعب
    const result = room.players.map(p => ({
      playerName: p.name,
      count: voteCount[p.name] || 0
    }));
    io.to(roomCode).emit('vote-result', result);

    // 🟨 🆕 إرسال عدد المصوتين وعدد اللاعبين
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
    if (currentHost !== room.host) return; // فقط المضيف يستطيع النقل

    room.host = newHost;

    io.to(roomCode).emit('host-transferred', { newHost });

    const targetSocket = Object.values(io.sockets.sockets).find(
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

  socket.on('disconnect', () => {
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

const PORT = 3000;
server.listen(PORT, () => console.log(`🚀 الخادم يعمل على http://localhost:${PORT}`));
