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