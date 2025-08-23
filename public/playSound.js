// دالة لتشغيل الصوت
function playSound(id) {
    const enableSounds = document.getElementById('toggleSounds')?.checked;
    if (!enableSounds) return;
    const audio = document.getElementById(id);
    if (audio) {
    audio.currentTime = 0;
    audio.play();
    }
}