const socket = io();
let currentRoom = "";

function startGame() {
    socket.emit("start-game", currentRoom);
}

socket.on("update-room", room => {
    currentRoom = room.roomId;
    const list = document.getElementById("playersList");
    list.innerHTML = "";
    room.players.forEach(p => {
        const li = document.createElement("li");
        li.innerText = p.name + (p.alive === false ? " (ميت)" : "");
        list.appendChild(li);
    });

    if (socket.id === room.hostId) {
        document.getElementById("hostSection").classList.remove("hidden");
        document.getElementById("mafiaCountDisp").innerText = room.mafiaCount;
    }
});
