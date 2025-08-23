
const roomIdField = document.getElementById('roomIdField');

roomIdField.addEventListener('input', function () {
    const arabicNums = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
    '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
    };

    this.value = this.value.replace(/[٠-٩۰-۹]/g, d => arabicNums[d]);
});
const socket = io("https://gamemafia.onrender.com", {
    transports: ["websocket", "polling"]
});

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.getElementById('toastContainer').appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function refreshRooms() {
    socket.emit('get-rooms-info');
}

socket.on('rooms-info', rooms => {
    console.log("📥 Data from server:", rooms);
    const list = document.getElementById('roomsList');
    list.innerHTML = '';

    // فلترة: فقط الغرف اللي الـ host موجود فيها
    const activeRooms = rooms.filter(room => room.hostOnline);

    if (activeRooms.length === 0) {
        const msg = document.createElement('div');
        msg.textContent = 'لا توجد طاولات متاحة حالياً.';
        msg.style.marginTop = '10px';
        list.appendChild(msg);
        return;
    }

    activeRooms.forEach(room => {
        const btn = document.createElement('button');
        
        if (!room.started) {
            btn.textContent = `طاولة ${room.roomCode} - ${room.playerCount} لاعب - في انتظار اللاعبين`;
        } else {
            btn.textContent = `طاولة ${room.roomCode} - ${room.playerCount} لاعب - لقد بدأت اللعبة (الدخول كمشاهد)`;
        }

        btn.style.margin = '5px';
        btn.onclick = () => {
            document.getElementById('roomIdField').value = room.roomCode;
        };

        list.appendChild(btn);
    });
});

function showCreateRoom() {
    const name = document.getElementById('playerName').value.trim();
    if (!name) {
    showToast('يرجى إدخال اسمك أولاً');
    return;
    }
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('createRoomSection').classList.remove('hidden');
}

function showJoinRoom() {
    const name = document.getElementById('playerName').value.trim();
    if (!name) {
    showToast('يرجى إدخال اسمك أولاً');
    return;
    }
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('joinRoomSection').classList.remove('hidden');
    refreshRooms();
}

function goBack() {
    document.getElementById('createRoomSection').classList.add('hidden');
    document.getElementById('joinRoomSection').classList.add('hidden');
    document.getElementById('loginSection').classList.remove('hidden');
}

function createRoom() {
    const name = document.getElementById('playerName').value.trim();
    const mafiaCount = document.getElementById('mafiaCount').value.trim();
    if (!name) {
    showToast('يرجى إدخال اسمك');
    return;
    }
    if (!mafiaCount || isNaN(mafiaCount) || Number(mafiaCount) <= 0) {
    showToast('يرجى إدخال عدد المافيا بشكل صحيح');
    return;
    }

    localStorage.setItem('playerName', name);
    localStorage.setItem('mafiaCount', mafiaCount);
    
    const roomCode = Math.floor(1000 + Math.random() * 9000).toString();
    document.cookie = `playerName=${name}`;
    document.cookie = `mafiaCount=${mafiaCount}`;
    document.cookie = `roomCode=${roomCode}`;
    document.cookie = `isHost=true`;

    socket.emit('create-room', { playerName: name, mafiaCount, roomCode });
    window.location.href = 'host.html';
}

function joinRoom() {
    const name = document.getElementById('playerName').value.trim();
    const roomCode = document.getElementById('roomIdField').value.trim();

    if (!name) {
        showToast('يرجى إدخال اسمك');
        return;
    }
    if (!roomCode || roomCode.length !== 4 || isNaN(roomCode)) {
        showToast('يرجى إدخال رقم طاولة صحيح (4 أرقام)');
        return;
    }

    // نخزن البيانات في الكوكيز
    document.cookie = `playerName=${name}`;
    document.cookie = `roomCode=${roomCode}`;
    document.cookie = `isHost=false`;

    // لو اللاعب عنده playerId من قبل (عشان يعرف إذا قديم)
    const playerId = localStorage.getItem("playerId");

    // نرسل طلب الانضمام للسيرفر
    socket.emit("join-room", { playerName: name, roomCode, playerId });
}

// لاعب جديد
socket.on("joined-as-player", ({ playerId }) => {
    localStorage.setItem("playerId", playerId);
    window.location.href = "player.html";
});

// لاعب قديم (كان في نفس الغرفة)
socket.on("rejoin-game", () => {
    window.location.href = "game.html";
});

// الغرفة مش موجودة
socket.on("room-not-found", () => {
    showToast("❌ الطاولة غير موجودة");
});


const nameInput = document.getElementById('playerName');

// حفظ الاسم أثناء الكتابة
nameInput.addEventListener('input', function () {
    localStorage.setItem('playerName', this.value);
});

// عند تحميل الصفحة: إذا فيه اسم محفوظ، اظهره تلقائياً
window.addEventListener('DOMContentLoaded', function () {
    const savedName = localStorage.getItem('playerName');
    if (savedName) {
    document.getElementById('playerName').value = savedName;
    }

    const savedMafiaCount = localStorage.getItem('mafiaCount');
    if (savedMafiaCount) {
    document.getElementById('mafiaCount').value = savedMafiaCount;
    }
});

// عند الضغط على أي زر: إعادة ملء الاسم في الحقل (احتياط)
document.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', function () {
    const savedName = localStorage.getItem('playerName');
    if (savedName) {
        nameInput.value = savedName;
    }
    });
});
