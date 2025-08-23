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