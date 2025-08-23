// الاتصال بالخادم عبر Socket.io
const socket = io("https://gamemafia.onrender.com", {
    transports: ["websocket", "polling"]
});
const playerName = getCookie('playerName'); // الحصول على اسم اللاعب من الكوكي
const roomCode = getCookie('roomCode'); // الحصول على رمز الغرفة من الكوكي
let eliminatedPlayers = new Set(); // لتتبع اللاعبين الذين تم إقصاؤهم
// إذا لم يكن اسم اللاعب أو رمز الغرفة موجودًا، أعد التوجيه إلى الصفحة الرئيسية
if (!playerName || !roomCode) {
    window.location.href = 'index.html';
}
// عرض اسم اللاعب ورمز الغرفة
document.getElementById('playerName').textContent = playerName;
document.getElementById('roomCode').textContent = roomCode;
// طلب الانضمام إلى الغرفة
socket.emit('player-join-room', { playerName, roomCode });
// استقبال تحديث قائمة اللاعبين
socket.on('update-players', players => {
    const activePlayers = players.filter(p => !p.spectator && !eliminatedPlayers.has(p.name)).length;
    document.getElementById('totalPlayers').textContent = activePlayers;
    const list = document.getElementById('playersList');
    const targetSelect = document.getElementById('giftTarget');
    list.innerHTML = '';
    targetSelect.innerHTML = '<option value="all">لكل اللاعبين</option>';
    players.forEach(player => {
    const statusClass = player.status === 'online' ? 'online' : player.status === 'idle' ? 'idle' : 'offline';
    const cardId = `player-${player.name.replace(/\s/g, '-')}`;
    list.innerHTML += `
        <div class="player-card" id="${cardId}">
        <div class="status ${statusClass}"></div>
        <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${player.name}" />
        <h4>${player.name}</h4>
        <button class="kick-button" onclick="kickPlayer('${player.name}')">طرد</button>
        </div>
    `;
    targetSelect.innerHTML += `<option value="${player.name}">${player.name}</option>`;
    });
});
// دالة طرد لاعب
function kickPlayer(playerName) {
    socket.emit('kick-player', { roomCode, playerName });
}
// دالة بدء اللعبة
function startGame() {
    socket.emit('start-game', { roomCode });
}
// دالة لمساعدتنا في الحصول على الكوكيز
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}
// استقبال بدء اللعبة
socket.on('game-started', ({ role, roomCode, round }) => {
    document.cookie = `role=${role}; path=/`;
    document.cookie = `round=${round}; path=/`;
    window.location.href = 'game.html';
});
// العودة إلى الصفحة الرئيسية
function goToHome() {
    window.location.href = 'index.html';
}