const socket = io();

function createRoom() {
    const name = document.getElementById("playerName").value;
    const mafiaCount = parseInt(document.getElementById("mafiaCount").value);
    if (!name || isNaN(mafiaCount)) {
        alert("يرجى إدخال اسم وعدد المافيا");
        return;
    }
    socket.emit("create-room", { playerName: name, mafiaCount });
}

function joinRoom() {
    const name = document.getElementById("playerName").value;
    const room = document.getElementById("roomIdField").value;
    if (!name || room.length !== 4) return alert("يرجى إدخال اسم ورقم طاولة صحيح");
    socket.emit("join-room", { roomId: room, playerName: name });
}

socket.on("room-created", ({ roomId }) => {
    document.getElementById("login").classList.add("hidden");
    document.getElementById("lobby").classList.remove("hidden");
    document.getElementById("roomCode").innerText = roomId;
});

socket.on("joined-room", room => {
    document.getElementById("login").classList.add("hidden");
    document.getElementById("lobby").classList.remove("hidden");
    document.getElementById("roomCode").innerText = room.roomId;
});
