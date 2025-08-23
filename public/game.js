// الاتصال بالخادم عبر Socket.io
const socket = io("https://gamemafia.onrender.com", {
  transports: ["websocket", "polling"]
});
const playerName = getCookie('playerName'); // الحصول على اسم اللاعب من الكوكي
const roomCode = getCookie('roomCode'); // الحصول على كود الطاولة من الكوكي
const isHost = getCookie('isHost') === 'true'; // هل اللاعب هو الذي أنشأ الطاولة
let playersVoted = new Set(); // عدد المصوتين
let eliminatedPlayers = new Set(); // لتتبع اللاعبين الذين تم إقصاؤهم
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