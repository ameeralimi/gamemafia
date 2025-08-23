// الاتصال بالخادم عبر Socket.io
const socket = io("https://gamemafia.onrender.com", {
  transports: ["websocket", "polling"]
});
const playerName = getCookie('playerName'); // الحصول على اسم اللاعب من الكوكي
const roomCode = getCookie('roomCode'); // الحصول على كود الطاولة من الكوكي
const isHost = getCookie('isHost') === 'true'; // هل اللاعب هو الذي أنشأ الطاولة
let playersVoted = new Set(); // عدد المصوتين
let eliminatedPlayers = new Set(); // لتتبع اللاعبين الذين تم إقصاؤهم
document.getElementById('playerName').textContent = playerName;
document.getElementById('tableCodeDisplay').textContent = roomCode; // رقم الطاولة
document.getElementById('roundNum').textContent = getCookie('round') || '1'; // الجولة
const role = getCookie('role');  // الحصول على الدور الخاص باللاعب
const mafiaCount = getCookie('mafiaCount'); // الحصول على عدد المافيا المتبقيين
let revealed = false; // الدور
// دالة الحصول على الكوكي
function toggleRole() {
  const roleSpan = document.getElementById('role');
  revealed = !revealed;
  roleSpan.style.filter = revealed ? 'none' : 'blur(15px)';
}
// إظهار زر الإقصاء إذا كنت المضيف
if (isHost) {
  document.getElementById('kickPlayerButton').style.display = 'block';
}
// حدث التصويت يظهر في الدردشه زر الاعدادات الخاص به
document.getElementById('toggleVoteMessages').addEventListener('change', (e) => {
  const show = e.target.checked;
  socket.emit('set-vote-messages-visibility', { roomCode, show });
});
// إظهار أو إخفاء زر الإعدادات إذا كنت المضيف
if (getCookie('isHost') === 'true') {
  document.getElementById('settings').style.display = 'block';
} else {
  document.getElementById('settings').style.display = 'none';
}
// انتها من حدث التصويت يظهر في الدردشة زر الاعدادات الخاص به
function kickVotedPlayer() {
  socket.emit('kick-voted-player', { roomCode });
}
// استقبال تحديث الجولة
socket.on('update-round', ({ round }) => {
  document.getElementById('roundNum').textContent = round;
});
// استقبال حدث اقصاء لاعب
socket.on('you-have-been-kicked', () => {
  // 🟥 إخفاء جميع أزرار التصويت عند اللاعب الذي تم اقصاؤه فقط
  document.querySelectorAll('.vote-button').forEach(btn => {
    btn.style.display = 'none';
  });
  const submitVoteButton = document.getElementById('submitVoteButton');
  if (submitVoteButton) {
    submitVoteButton.style.display = 'none';
  }
  // 🟨 إنشاء النافذة المنبثقة
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.backgroundColor = 'rgba(0,0,0,0.6)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '9999';
  const popup = document.createElement('div');
  popup.style.background = '#fff';
  popup.style.padding = '30px';
  popup.style.borderRadius = '20px';
  popup.style.textAlign = 'center';
  popup.style.maxWidth = '400px';
  popup.style.width = '90%';
  popup.style.boxShadow = '0 5px 15px rgba(0,0,0,0.3)';
  popup.style.animation = 'popupFade 0.4s ease';
  // العنوان
  const title = document.createElement('h2');
  title.innerText = 'لقد خسرت 😢';
  title.style.color = '#f44336';
  title.style.marginBottom = '20px';
  title.style.fontSize = '24px';
  // الوجه الحزين الكبير
  const sadFace = document.createElement('div');
  sadFace.innerText = '😭';
  sadFace.style.fontSize = '80px';
  sadFace.style.marginBottom = '20px';
  // النص اللي يوضح
  const message = document.createElement('p');
  message.innerText = '❌ تم إقصاؤك. لم تعد جزءًا من التصويت.';
  message.style.color = 'red';
  message.style.fontSize = '16px';
  message.style.marginBottom = '25px';
  // زر المتابعة كمشاهد
  const button = document.createElement('button');
  button.innerText = 'المتابعة في اللعبة كمشاهد';
  button.className = 'back-button';
  button.onclick = () => {
    document.body.removeChild(overlay);
  };
  // ضم العناصر
  popup.appendChild(title);
  popup.appendChild(sadFace);
  popup.appendChild(message);
  popup.appendChild(button);
  overlay.appendChild(popup);
  document.body.appendChild(overlay);
  // أنيميشن CSS
  const style = document.createElement('style');
  style.innerHTML = `
    @keyframes popupFade {
      from { transform: scale(0.7); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
});
// استقبال رسالة تعادل التصويت
socket.on('vote-tie', ({ message }) => {
  const box = document.getElementById('chatBox');
  const div = document.createElement('div');
  div.className = 'chat-message';
  div.innerHTML = `<em>${message}</em>`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
});
// عرض الدور
document.getElementById('role').textContent = role === 'mafia' ? 'مافيا' : 'مواطن';
// استقبال تحديث قائمة اللاعبين
socket.emit('player-join-room', { playerName, roomCode });
// استقبال تحديث قائمة اللاعبين
socket.on('update-players', (players) => {
  // 🟢 حساب المشاهدين واللاعبين الفعّالين
  const spectators = players.filter(p => p.spectator).length;
  const activePlayers = players.filter(p => !p.spectator && !eliminatedPlayers.has(p.name)).length;
  // 🟢 تحديث العدادات
  document.getElementById('totaspectator').textContent = spectators;
  document.getElementById('totalPlayers').textContent = activePlayers;
  playersVoted.clear();
  updateVoteStatus();
  // 🟢 تحديث قائمة الإهداء
  const giftTarget = document.getElementById('giftTarget');
  giftTarget.innerHTML = '<option value="all">لكل اللاعبين</option>';
  players.forEach(player => {
    if (!player.spectator && !eliminatedPlayers.has(player.name)) {
      const option = document.createElement('option');
      option.value = player.name;
      option.textContent = player.name;
      giftTarget.appendChild(option);
    }
  });
  // 🟢 تحديث قائمة اللاعبين
  const list = document.getElementById('playersList');
  players.forEach(player => {
    const statusClass = player.status === 'online' ? 'online' : player.status === 'idle' ? 'idle' : 'offline';
    const card = document.createElement('div');
    card.className = 'player-card' + (player.role === 'mafia' ? ' mafia' : '');
    card.id = `card-${player.name}`;
    // النص اللي يوضح حالته
    let extraStatus = '';
    let canVote = true;
    if (player.spectator) {
      extraStatus = `<span style="color:red"> - مشاهد</span>`;
      canVote = false;
    }
    if (eliminatedPlayers.has(player.name)) {
      extraStatus = `<span style="color:gray"> - تم اقصاؤه (${player.role === 'mafia' ? 'مافيا' : 'مواطن'})</span>`;
      canVote = false;
    }
    const voteCountElement = `<div class="vote-count" id="vote-${player.name}">0</div>`;
    const mafiaBtn = player.role === 'mafia'
      ? '<button class="mafia-btn" onclick="toggleMafiaVisibility()">👁️</button>'
      : '';
    // اللاعب الحالي (أنا)
    const me = players.find(p => p.name === playerName);
    // زر التصويت يظهر فقط إذا اللاعب الهدف قابل للتصويت أنا (المتصل الحالي) لست مشاهد ولا مقصي
    const voteBtn = (
      canVote &&
      me &&
      !me.spectator &&
      !eliminatedPlayers.has(me.name)
    )
      ? `<button class="vote-btn" onclick="vote('${player.name}')">تصويت</button>`
      : '';
    card.innerHTML = `
      <div class="status ${statusClass}"></div>
      ${voteCountElement}
      <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${player.name}" />
      <h4>${player.name}${extraStatus}</h4>
      ${mafiaBtn}
      ${voteBtn}
    `;
    list.appendChild(card);
  });
  // 🟢 إظهار المافيا لبعضهم
  if (role === 'mafia') {
    const mafiaNames = players
      .filter(player => player.role === 'mafia')
      .map(player => player.name)
      .join('، ');
    document.getElementById('mafiaallgame').textContent = mafiaNames;
  } else {
    document.querySelector('.mafia-info').style.display = 'none';
  }
  // 🟢 إدارة نقل المضيف
  if (getCookie('isHost') === 'true') {
    const section = document.getElementById('transferHostSection');
    const list = document.getElementById('transferList');
    section.style.display = 'block';
    list.innerHTML = '';
    players.forEach(p => {
      if (p.name === playerName) return;
      const btn = document.createElement('button');
      btn.textContent = `عيّن ${p.name} كمضيف`;
      btn.onclick = () => {
        socket.emit('transfer-host', { roomCode, newHost: p.name });
      };
      list.appendChild(btn);
    });
  }
});
// إذا كان مافيا → اطلب قائمة المافيا
if (role === 'mafia') {
  socket.emit('get-mafia', { roomCode, playerName });
}
// استقبال قائمة المافيا
socket.on('show-mafia', (mafiaPlayers) => {
  const mafiaListContainer = document.getElementById('mafiaallgame');
  if (!mafiaListContainer) return;
  mafiaListContainer.innerHTML = mafiaPlayers
    .map(p => `<div>🕵️‍♂️ ${p.name}</div>`)
    .join('');
});
// استقبال حدث تعيين المضيف الجديد
socket.on('you-are-now-host', () => {
  // ✅ تعيين الكوكي isHost=true
  document.cookie = "isHost=true; path=/";
  // ✅ إظهار زر الإقصاء
  document.getElementById('kickPlayerButton').style.display = 'block';
  // ✅ إظهار قسم تعيين المضيف الجديد
  const transferSection = document.getElementById('transferHostSection');
  if (transferSection) {
    transferSection.style.display = 'block';
    const list = document.getElementById('transferList');
    list.innerHTML = ''; // تنظيف الأزرار القديمة
    // ✅ إعادة توليد أزرار التعيين
    socket.emit('player-join-room', { playerName, roomCode }); // هذا سيجعل السيرفر يعيد إرسال اللاعبين
  }
});
// استقبال حدث نقل المضيف
socket.on('host-transferred', ({ newHost }) => {
  const isMeHost = newHost === playerName;
  // حفظ الكوكي
  document.cookie = `isHost=${isMeHost}; path=/`;
  // إظهار أو إخفاء العناصر الخاصة بالمضيف الجديد
  const transferSection = document.getElementById('transferHostSection');
  if (transferSection) transferSection.style.display = isMeHost ? 'block' : 'none';
  const kickButton = document.getElementById('kickPlayerButton');
  if (kickButton) kickButton.style.display = isMeHost ? 'block' : 'none';
});
// دالة إظهار وإخفاء قائمة المافيا
function toggleMafiaVisibility() {
  const role22 = document.getElementById('role').textContent.trim();  // جلب النص الموجود في العنصر
  const mafiaallgame22 = document.getElementById('mafiaallgame22');
  if (role22 !== 'مافيا') return; // إذا لم يكن مافيا لا تعمل شيء
  if (mafiaallgame22.style.display === 'block') {
    mafiaallgame22.style.display = 'none';
  } else {
    mafiaallgame22.style.display = 'block';
  }
}
// استقبال تحديث عدد المصوتين
socket.on('update-vote-count', ({ votedCount, totalPlayers }) => {
  document.getElementById('voteStatus').textContent = votedCount;
  document.getElementById('totalPlayers').textContent = totalPlayers;
});
// دالة تحقق الإقصاء التلقائي
function checkAutoExclusion() {
  const autoExclusion = document.getElementById('Automatic_exclusion').checked;
  // 🚫 إذا التشيك بوكس غير مفعل → اطلع فوراً
  if (autoExclusion == false) {
    console.log("❌ الإقصاء التلقائي ملغي (checkbox غير مفعل)");
  }else {
    console.log("✅ الإقصاء التلقائي مفعل (checkbox مفعل)");
    // ✅ هنا فقط لو التشيك بوكس مفعل
    const totalPlayers = parseInt(document.getElementById('totalPlayers').textContent, 10);
    const voteStatus = parseInt(document.getElementById('voteStatus').textContent, 10);
    if (totalPlayers > 0 && voteStatus === totalPlayers) {
      console.log("✅ سيتم الإقصاء التلقائي");
      kickVotedPlayer();
    }
  }
}
// دالة التصويت
function vote(target) {
  if (!playersVoted.has(playerName)) {
    playersVoted.add(playerName);
    updateVoteStatus(); // تحديث عدد المصوتين
  }
  // تشغيل صوت التصويت
  playSound('voteSound');
  // إرسال التصويت إلى السيرفر
  socket.emit('vote-player', { roomCode, playerName, target });
  // ✅ تحقق إذا لازم نسوي اقصاء تلقائي
  checkAutoExclusion();
}
// تحديث حالة التصويت في الواجهة
function updateVoteStatus() {
  document.getElementById('voteStatus').textContent = playersVoted.size;
}
// استقبال نتائج التصويت وتحديث العدادات
socket.on('vote-result', (results) => {
  results.forEach(({ playerName, count }) => {
    const el = document.getElementById(`vote-${playerName}`);
    if (el) el.textContent = count;
  });
  // إعادة تحديث حالة التصويت
  updateVoteStatus();
});
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}
// استقبال حدث إقصاء لاعب
socket.on('player-eliminated', ({ name, role }) => {
  eliminatedPlayers.add(name);
  playersVoted.clear();
  updateVoteStatus();
  playSound('kickSound');
  const box = document.getElementById('chatBox');
  const div = document.createElement('div');
  div.className = 'chat-message';
  div.innerHTML = `<strong>❌ ${name} تم إقصاؤه من اللعبة. كان ${role === 'mafia' ? '🟥 مافيا' : '🟦 مواطن'}.</strong>`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  // تحديث مظهر الكرت
  const card = document.getElementById(`card-${name}`);
  if (card) {
    card.style.opacity = '0.5';
    card.querySelector('.vote-btn')?.remove();
  }
});
// إعادة الاتصال عند الرجوع من الخلفية
document.addEventListener("visibilitychange", () => {
  if (!socket.connected && document.visibilityState === "visible") {
    socket.connect(); // إعادة الاتصال عند الرجوع من الخلفية
  }
});
// العودة الى الرئيسية
function goToHome() {
  window.location.href = 'index.html';
}
// ضبط الإقصاء التلقائي على إيقاف عند تحميل الصفحة
window.addEventListener('load', () => {
  document.getElementById('Automatic_exclusion').checked = true;
});
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
        micBtn.click(); // كأن المستخدم ضغط على زر الميكروفون
        spkBtn.click(); // كأن المستخدم ضغط على زر السماعة
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
