import React from "https://esm.sh/react@18";
import ReactDOM from "https://esm.sh/react-dom@18/client";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// Networking setup
const ws = new WebSocket(`ws://${location.host}/ws`);
const playerId = Math.random().toString(36).slice(2);
const others = {};

let playing = false;
let score = 0;
let shakeTime = 0;
let darkMode = false;
let emojiText = "";
let emojiTimer = 0;

const player = {
  x: 80,
  y: canvas.height / 2,
  vy: 0,
  radius: 20,
  fatigue: 0,
  sliding: false,
  alive: true,
};

let obstacles = [];
let lastObstacle = 0;
let speed = 2;
let setScore = () => {};

function addObstacle() {
  const gap = 120;
  const top = 20 + Math.random() * (canvas.height - gap - 40);
  obstacles.push({ x: canvas.width, width: 40, top, gap });
}

function update(delta) {
  player.fatigue += delta;
  const gravity = 0.5 + player.fatigue * 0.01;
  player.vy += gravity;
  player.y += player.vy;

  // Boundaries
  if (player.y + player.radius > canvas.height) {
    player.y = canvas.height - player.radius;
    player.vy = 0;
  }
  if (player.y - player.radius < 0) {
    player.y = player.radius;
    player.vy = 0;
  }

  for (const obs of obstacles) {
    obs.x -= speed;
    if (
      player.x + player.radius > obs.x &&
      player.x - player.radius < obs.x + obs.width
    ) {
      if (player.y - player.radius < obs.top || player.y + player.radius > obs.top + obs.gap) {
        player.alive = false;
      }
    }
  }
  obstacles = obstacles.filter((o) => o.x + o.width > 0);
  lastObstacle += delta * 1000;
  if (lastObstacle > 1500) {
    addObstacle();
    lastObstacle = 0;
    speed += 0.1;
    score += 1;
    setScore(score);
  }
}

function draw() {
  if (shakeTime > 0) {
    ctx.save();
    ctx.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
    shakeTime--;
  }

  ctx.fillStyle = darkMode ? "#111" : "#333";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#555";
  for (const obs of obstacles) {
    ctx.fillRect(obs.x, 0, obs.width, obs.top);
    ctx.fillRect(obs.x, obs.top + obs.gap, obs.width, canvas.height - (obs.top + obs.gap));
  }

  ctx.fillStyle = "gray";
  for (const key in others) {
    const o = others[key];
    if (!o.alive) continue;
    ctx.beginPath();
    ctx.arc(player.x, o.y, player.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "white";
  ctx.beginPath();
  const r = player.sliding ? player.radius * 0.6 : player.radius;
  ctx.arc(player.x, player.y, r, 0, Math.PI * 2);
  ctx.fill();

  if (emojiTimer > 0) {
    ctx.font = "20px sans-serif";
    ctx.fillText(emojiText, player.x - 10, player.y - r - 10);
    emojiTimer--;
  }

  if (shakeTime > 0) ctx.restore();
}

function loop(time) {
  const delta = (time - lastTime) / 1000;
  lastTime = time;
  if (playing && player.alive) {
    update(delta);
    sendState();
  }
  draw();
  requestAnimationFrame(loop);
}
let lastTime = performance.now();
requestAnimationFrame(loop);

function sendState() {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({ type: "state", id: playerId, y: player.y, alive: player.alive })
    );
  }
}

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === "state" && msg.id !== playerId) {
    others[msg.id] = msg;
  } else if (msg.type === "command") {
    if (msg.value === "/shake") shakeTime = 20;
    if (msg.value === "/dark") darkMode = !darkMode;
  } else if (msg.type === "emoji") {
    emojiText = msg.value;
    emojiTimer = 60;
  }
};

document.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    player.vy = -(10 - player.fatigue * 0.1);
    ws.send(JSON.stringify({ type: "emoji", value: "😄" }));
  }
  if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
    player.sliding = true;
  }
});

document.addEventListener("keyup", (e) => {
  if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
    player.sliding = false;
  }
});

function captureScreenshot() {
  const url = canvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.href = url;
  link.download = "tirevibe.png";
  link.click();
}

function App() {
  const [started, setStarted] = React.useState(false);
  const [scoreState, setScoreState] = React.useState(0);
  const [input, setInput] = React.useState("");
  setScore = setScoreState;

  const send = () => {
    if (!input) return;
    if (input.startsWith("/")) {
      ws.send(JSON.stringify({ type: "command", value: input }));
    } else {
      ws.send(JSON.stringify({ type: "emoji", value: input }));
    }
    setInput("");
  };

  const start = () => {
    playing = true;
    setStarted(true);
  };

  return React.createElement(
    "div",
    { className: "p-2 flex space-x-2 items-center" },
    [
      !started &&
        React.createElement(
          "button",
          { className: "bg-green-500 px-2 py-1 rounded", onClick: start },
          "Start"
        ),
      React.createElement("span", null, `Score: ${scoreState}`),
      React.createElement("input", {
        className: "text-black px-1",
        value: input,
        onChange: (e) => setInput(e.target.value),
      }),
      React.createElement(
        "button",
        { className: "bg-blue-500 px-2 py-1 rounded", onClick: send },
        "Send"
      ),
      React.createElement(
        "button",
        { className: "bg-purple-500 px-2 py-1 rounded", onClick: captureScreenshot },
        "Screenshot"
      ),
    ]
  );
}

ReactDOM.createRoot(document.getElementById("hud")).render(React.createElement(App));
