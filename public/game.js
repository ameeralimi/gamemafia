const socket = io();
let myRole = "", mafiaList = [], phase = "", timer = 0;

function toggleMyRole() {
  const role = document.getElementById("myRole");
  role.style.visibility = role.style.visibility === "hidden" ? "visible" : "hidden";
}

function toggleMafia() {
  const box = document.getElementById("mafiaList").parentElement;
  box.classList.toggle("hidden");
}

function startVote(voteFor) {
  socket.emit("vote", { voteFor, roomId: currentRoom });
}

function killPlayer(playerId) {
  socket.emit("kill-player", { playerId, roomId: currentRoom });
}

socket.on("role-assigned", data => {
  myRole = data.role;
  document.getElementById("myRole").innerText = myRole;
  if (data.mafiaList && data.mafiaList.length > 0) {
    mafiaList = data.mafiaList;
    const list = document.getElementById("mafiaList");
    mafiaList.forEach(name => {
      const li = document.createElement("li");
      li.innerText = name;
      list.appendChild(li);
    });
  } else {
    document.getElementById("mafiaList").parentElement.classList.add("hidden");
  }
});

socket.on("game-started", () => {
  document.getElementById("lobby").classList.add("hidden");
  document.getElementById("gameUI").classList.remove("hidden");
  phase = "night";
  updatePhaseDisplay();
});

socket.on("phase-update", (newPhase) => {
  phase = newPhase;
  updatePhaseDisplay();
});

function updatePhaseDisplay() {
  document.getElementById("phase").innerText = `المرحلة الحالية: ${phase}`;
}

socket.on("timer", (timeLeft) => {
  timer = timeLeft;
  document.getElementById("phase").innerText = `الوقت المتبقي: ${timer}s`;
});

socket.on("game-over", (winner) => {
  alert(`العبة انتهت! الفائزون: ${winner}`);
});
