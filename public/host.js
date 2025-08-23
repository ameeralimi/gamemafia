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
// ارسال رسائل الدردشة
function sendMessage() {
    const msg = document.getElementById('chatInput').value.trim();
    if (!msg) return;
    socket.emit('chat-message', { roomCode, playerName, message: msg });
    document.getElementById('chatInput').value = '';
}
document.getElementById('chatInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
    e.preventDefault();
    sendMessage();
    }
});
// استقبال رسائل الدردشة
socket.on('chat-message', ({ playerName, message }) => {
    const box = document.getElementById('chatBox');
    const div = document.createElement('div');
    div.className = 'chat-message';
    div.innerHTML = `<strong>${playerName}:</strong> ${message}`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
});
// ارسال واستقبال الهدايا مع انيميشن وصوت
function sendGift(gift) {
    const target = document.getElementById('giftTarget').value;
    socket.emit('send-gift', { roomCode, playerName, gift, target });
}
// داخل دالة استقبال الهدية:
socket.on('receive-gift', ({ playerName: sender, gift, target }) => {
    let recipientList;
    // 🟡 تشغيل الصوت حسب نوع الهدية
    const giftSounds = {
    '🌹': 'sound-rose',
    '🍅': 'sound-tomato',
    '💣': 'sound-bomb',
    '🐴': 'sound-donkey',
    '😢': 'a',
    '😂': 'b'
    };
    const audioId = giftSounds[gift];
    if (audioId) {
    playSound(audioId);
    }
    // 🎯 تحديد المستلمين
    if (target === 'all') {
    recipientList = Array.from(document.querySelectorAll('.player-card'));
    } else {
    recipientList = [document.getElementById(`card-${target}`)];
    }
    // ✨ تنفيذ الأنيميشن للهدية
    recipientList.forEach(card => {
    if (!card) return;
    const anim = document.createElement('div');
    anim.className = 'gift-anim';
    anim.textContent = gift;
    card.appendChild(anim);
    setTimeout(() => anim.remove(), 1000);
    });
    // 📝 إضافة رسالة إلى الدردشة
    const box = document.getElementById('chatBox');
    const div = document.createElement('div');
    const msg = target === 'all'
    ? `${sender} أرسل هدية ${gift} للجميع 🎁`
    : `${sender} أرسل ${gift} إلى ${target}`;
    div.className = 'chat-message';
    div.innerHTML = `<em>${msg}</em>`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
});
// ✅ إعدادات المايك والسماعة
// هذا الكود يستخدم WebRTC للتواصل الصوتي بين اللاعبين في نفس الغرفة
(function initVoiceUI() {
    const container = document.querySelector('.container') || document.body;
    const wrap = document.createElement('div');
    wrap.className = 'voice-controls';
    wrap.style.cssText = `
    display:flex; gap:8px; align-items:center; margin:12px 0;
    padding:8px; border:1px solid #eee; border-radius:12px;
    `;
    const micBtn = document.createElement('button');
    micBtn.id = 'micButton';
    micBtn.textContent = '🎤'; 
    micBtn.title = 'تشغيل/إيقاف الميكروفون';
    micBtn.style.cssText = 'font-size:18px; padding:8px 12px; border-radius:10px;';
    const spkBtn = document.createElement('button');
    spkBtn.id = 'speakerButton';
    spkBtn.textContent = '🔊'; 
    spkBtn.title = 'تشغيل/كتم السماعات';
    spkBtn.style.cssText = 'font-size:18px; padding:8px 12px; border-radius:10px;';
    const hint = document.createElement('span');
    hint.textContent = 'المحادثة الصوتية';
    hint.style.cssText = 'opacity:.8; font-size:14px; margin-inline-start:6px;';
    wrap.appendChild(micBtn);
    wrap.appendChild(spkBtn);
    wrap.appendChild(hint);
    const anchor = document.querySelector('.players') || container.firstChild;
    container.insertBefore(wrap, anchor);
    // ✅ شغل المايك مباشرة بعد إنشاء الأزرار
    window.addEventListener("load", () => {
        micBtn.click(); // كأن المستخدم ضغط على زر الميكروفون
        spkBtn.click(); // كأن المستخدم ضغط على زر السماعة
        micBtn.click(); // كأن المستخدم ضغط على زر الميكروفون
    });
})();
let localStream = null; // تدفق المايك
let micOn = false; // هل المايك شغال
let speakersOn = true; // هل السماعات شغالة
const peers = {}; // اتصالات بزملاء
const peerAudioEls = {}; // عناصر صوت الزملاء
// تحديث أيقونة الميكروفون
function updateMicIcon() {
    const btn = document.getElementById('micButton');
    if (!btn) return;
    btn.textContent = micOn ? '🛑' : '🎤';
}
// تحديث أيقونة السماعة
function updateSpeakerIcon() {
    const btn = document.getElementById('speakerButton');
    if (!btn) return;
    btn.textContent = speakersOn ? '🔊' : '🔇';
}
// دالة لإنشاء عنصر صوت لزميل
function createRemoteAudioEl(peerId) {
    let audio = peerAudioEls[peerId];
    if (!audio) {
    audio = document.createElement('audio');
    audio.id = `voice-audio-${peerId}`;
    audio.autoplay = true;
    audio.playsInline = true; // مهم جدًا للجوال
    audio.muted = !speakersOn;
    document.body.appendChild(audio);
    peerAudioEls[peerId] = audio;
    }
    return audio;
}
// دالة لإزالة زميل
function removePeer(peerId) {
    try {
    const pc = peers[peerId];
    if (pc) {
        // لا توقف s.track (المحلي)! فقط أغلق الاتصال ونظّف.
        try {
        pc.getSenders().forEach(sender => {
            try { pc.removeTrack(sender); } catch {}
        });
        } catch {}
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.onconnectionstatechange = null;
        try { pc.close(); } catch {}
    }
    } catch {}
    delete peers[peerId];
    const audio = peerAudioEls[peerId];
    if (audio) {
    try { audio.srcObject = null; } catch {}
    audio.remove();
    delete peerAudioEls[peerId];
    }
}
// دالة لإنشاء اتصال بزميل
function createPeerConnection(peerId) {
    // اعدادات api الخاص بالصوت ومعالجته وارسالة
    // لازم يكون هذا عبر شركة مدفوعة او لو عبر اي شبكة 
    // او هذا مجاني لكن يشتغل على الشبكة المحلية فقط
    // const pc = new RTCPeerConnection({
    //   iceServers: [
    //     { urls: "stun:stun.l.google.com:19302" }, // سيرفر STUN مجاني من Google 
    //     {
    //       urls: "turn:openrelay.metered.ca:80", // سيرفر TURN مجاني للتجربة 
    //       username: "openrelayproject",
    //       credential: "openrelayproject",
    //     },
    //   ],
    // });
    const pc = new RTCPeerConnection({
    iceServers: [
        {
            urls: "stun:stun.relay.metered.ca:80",
        },
        {
            urls: "turn:global.relay.metered.ca:80",
            username: "5445e58580409e5dd00a8ffc",
            credential: "Rt6yzNe4/iSwC4TE",
        },
        {
            urls: "turn:global.relay.metered.ca:80?transport=tcp",
            username: "5445e58580409e5dd00a8ffc",
            credential: "Rt6yzNe4/iSwC4TE",
        },
        {
            urls: "turn:global.relay.metered.ca:443",
            username: "5445e58580409e5dd00a8ffc",
            credential: "Rt6yzNe4/iSwC4TE",
        },
        {
            urls: "turns:global.relay.metered.ca:443?transport=tcp",
            username: "5445e58580409e5dd00a8ffc",
            credential: "Rt6yzNe4/iSwC4TE",
        },
    ],
    });
    if (localStream) {
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }
    pc.onicecandidate = (e) => {
    if (e.candidate) {
        socket.emit('voice-ice', { roomCode, to: peerId, candidate: e.candidate });
    }
    };
    pc.ontrack = (e) => {
    console.log("🎧 استلمت صوت من:", peerId, e.streams);
    const audio = createRemoteAudioEl(peerId);
    audio.srcObject = e.streams[0];
    audio.autoplay = true;
    audio.playsInline = true;  // مهم للموبايل
    audio.muted = !speakersOn; 
    audio.play().catch(err => console.warn("فشل تشغيل الصوت:", err));
    };
    document.body.addEventListener('click', () => {
    Object.values(peerAudioEls).forEach(a => {
        a.play().catch(()=>{});
    });
    });
    socket.on("voice-receive", (stream) => {
    console.log("🎧 استلمت صوت من:", stream);
    // أنشئ أو جِب عنصر <audio>
    let audio = document.getElementById("remoteAudio");
    if (!audio) {
        audio = document.createElement("audio");
        audio.id = "remoteAudio";
        audio.autoplay = true; // مهم: يشغل مباشرة
        document.body.appendChild(audio);
    }
    // اربط الـ stream بالصوت
    audio.srcObject = stream;
    });
    pc.onconnectionstatechange = () => {
    if (['failed','disconnected','closed'].includes(pc.connectionState)) {
        removePeer(peerId);
    }
    };
    peers[peerId] = pc;
    return pc;
}
// دالة للاتصال بزميل
async function callPeer(peerId) {
    const pc = peers[peerId] || createPeerConnection(peerId);
    const offer = await pc.createOffer({ offerToReceiveAudio: true });
    await pc.setLocalDescription(offer);
    socket.emit('voice-offer', { roomCode, to: peerId, offer });
}
// عند الدخول للغرفة
socket.emit('voice-join', { roomCode, playerName });
// استقبال قائمة اللاعبين المتصلين
socket.on('voice-peers', async ({ ids }) => {
    for (const id of ids) {
    if (socket.id < id) { // أنا أبدأ فقط لو آي دي تبعي أصغر
        await callPeer(id);
    }
    }
});
// عند انضمام لاعب جديد
socket.on('voice-peer-joined', async ({ id }) => {
    // فقط طرف واحد يبادر
    if (socket.id < id) {
    // لا توقف الميك داخل removePeer!
    removePeer(id);
    await callPeer(id);
    }
});
// استقبال اتصال صوتي
socket.on("voice-offer", async ({ from, offer }) => {
    const pc = peers[from] || createPeerConnection(from);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer({ offerToReceiveAudio: true });
    await pc.setLocalDescription(answer);
    socket.emit("voice-answer", { roomCode, to: from, answer });
});
// استقبال جواب اتصال صوتي
socket.on('voice-answer', async ({ from, answer }) => {
    const pc = peers[from];
    if (pc && answer) {
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
    // أعد تشغيل الأصوات للتأكد
    Object.values(peerAudioEls).forEach(a => {
        if (speakersOn) a.play().catch(()=>{});
    });
    }
});
// استقبال مرشح جليد ICE
socket.on('voice-ice', async ({ from, candidate }) => {
    const pc = peers[from];
    if (pc && candidate) {
    try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
    }
});
// عند خروج لاعب
socket.on('voice-peer-left', ({ id }) => {
    removePeer(id);
});
// زر الميكروفون
document.getElementById('micButton')?.addEventListener('click', async () => {
    try {
    if (!localStream) {
        // طلب إذن المايك أول مرة
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micOn = true;
        // أضف الصوت لكل اتصال مفتوح
        Object.values(peers).forEach(pc => {
        localStream.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
            track.enabled = true; // تأكد انه شغال
        });
        });
        console.log("🎤 الميكروفون اشتغل على الهاتف/الكمبيوتر");
    } else {
        // تشغيل/إيقاف المايك
        micOn = !micOn;
        localStream.getTracks().forEach(track => track.enabled = micOn);
    }
    updateMicIcon();
    } catch (err) {
    console.error('فشل تشغيل الميكروفون:', err);
    alert('تأكد أنك سمحت للمتصفح بالوصول للمايكروفون.');
    }
});
// زر السماعة
document.getElementById('speakerButton')?.addEventListener('click', () => {
    speakersOn = !speakersOn;
    updateSpeakerIcon();
    Object.values(peerAudioEls).forEach(a => {
    a.muted = !speakersOn;
    if (speakersOn) {
        a.play().catch(err => console.warn("فشل تشغيل الصوت:", err));
    }
    });
});
// بدء الميكروفون والسماعة
updateMicIcon();
updateSpeakerIcon();
// إعادة الاتصال عند الرجوع للصفحة
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && socket && !socket.connected) {
    socket.connect();
    socket.emit('voice-join', { roomCode, playerName });
    }
});
// نهاية كود الخاص بالدردشة الصوتية
