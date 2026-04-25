const screens = {
  entry: document.getElementById("entryScreen"),
  choose: document.getElementById("chooseScreen"),
  game: document.getElementById("gameScreen"),
};

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const gameClock = document.getElementById("gameClock");
const dayPhase = document.getElementById("dayPhase");
const warningBanner = document.getElementById("warningBanner");
const messageBox = document.getElementById("messageBox");
const woodCount = document.getElementById("woodCount");
const foodCount = document.getElementById("foodCount");
const houseCount = document.getElementById("houseCount");
const hudName = document.getElementById("hudName");
const hudAvatar = document.getElementById("hudAvatar");

const world = { width: 1280, height: 720 };
const START_TIME = 8 * 60;
const WARNING_TIME = 20.5 * 60;
const NIGHT_TIME = 21 * 60;
const SAFE_UNTIL_TIME = 21.5 * 60;
const REAL_SECONDS_UNTIL_NIGHT = 2 * 60;
const GAME_MINUTES_PER_SECOND = (NIGHT_TIME - START_TIME) / REAL_SECONDS_UNTIL_NIGHT;
const keys = new Set();
const touchDirs = new Set();
const art = {
  gameplay: new Image(),
  myra: new Image(),
  ivu: new Image(),
};
art.gameplay.src = "assets/game-bg.png";
art.myra.src = "assets/myra.png";
art.ivu.src = "assets/ivu.png";
let currentScreen = "entry";
let selectedCharacter = "myra";
let lastTime = performance.now();
let audio = null;

const state = {
  time: START_TIME,
  wood: 0,
  food: 0,
  house: 0,
  safePlace: null,
  insidePlace: null,
  wonNight: false,
  gameOver: false,
  noticeShown: false,
  secretFound: false,
  player: { x: 640, y: 420, r: 22, speed: 185 },
  horror: { x: 1100, y: 205, active: false },
  resources: [],
};

const zones = {
  treehouse: { x: 58, y: 92, w: 292, h: 342, label: "Treehouse" },
  secretHome: { x: 1075, y: 245, w: 135, h: 82, label: "Secret home" },
  house: { x: 910, y: 210, w: 330, h: 360, label: "House" },
  car: { x: 250, y: 455, w: 165, h: 85, label: "Car" },
  build: { x: 895, y: 250, w: 360, h: 330, label: "Build area" },
};

function makeResources() {
  state.resources = [
    { type: "wood", x: 460, y: 475, taken: false },
    { type: "wood", x: 520, y: 545, taken: false },
    { type: "wood", x: 790, y: 520, taken: false },
    { type: "food", x: 710, y: 455, taken: false },
    { type: "food", x: 835, y: 405, taken: false },
    { type: "food", x: 380, y: 360, taken: false },
    { type: "food", x: 1080, y: 560, taken: false },
  ];
}

function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove("is-active"));
  screens[name].classList.add("is-active");
  currentScreen = name;
  startAudio();
  audio?.ac.resume?.();
  setMusicMode(name);
}

function bindPress(element, handler) {
  let handledAt = 0;
  const run = (event) => {
    const now = performance.now();
    if (now - handledAt < 350) return;
    handledAt = now;
    event?.preventDefault?.();
    startAudio();
    audio?.ac.resume?.();
    handler(event);
  };
  element.addEventListener("click", run);
  element.addEventListener("touchend", run, { passive: false });
  element.addEventListener("pointerup", run);
}

function resetGame(character) {
  selectedCharacter = character;
  state.time = START_TIME;
  state.wood = 0;
  state.food = 0;
  state.house = 0;
  state.safePlace = null;
  state.insidePlace = null;
  state.wonNight = false;
  state.gameOver = false;
  state.noticeShown = false;
  state.secretFound = false;
  state.player.x = 640;
  state.player.y = 420;
  state.horror.active = false;
  makeResources();
  hudName.textContent = character === "myra" ? "Myra" : "Ivu";
  hudAvatar.classList.toggle("ivu", character === "ivu");
  setMessage("Collect wood and food. Build a house or find a safe hiding place before Horror arrives.");
  showScreen("game");
}

function startAudio() {
  if (audio) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const ac = new AudioContext();
  ac.resume?.();
  const master = ac.createGain();
  master.gain.value = 0.12;
  master.connect(ac.destination);

  audio = {
    ac,
    master,
    muted: false,
    mode: "entry",
    nextNote: 0,
    index: 0,
    timer: null,
  };

  audio.timer = window.setInterval(playMusicTick, 120);
  updateMuteButtons();
}

function setMusicMode(mode) {
  if (!audio) return;
  audio.mode = mode;
  audio.index = 0;
}

function playMusicTick() {
  if (!audio || audio.muted || audio.ac.currentTime < audio.nextNote) return;

  const palettes = {
    entry: [523.25, 659.25, 783.99, 1046.5, 783.99, 659.25],
    choose: [392, 493.88, 587.33, 659.25, 587.33, 493.88],
    game: state.horror.active
      ? [196, 207.65, 233.08, 174.61]
      : [293.66, 349.23, 440, 392, 349.23],
  };
  const notes = palettes[audio.mode] || palettes.entry;
  const frequency = notes[audio.index % notes.length];
  const now = audio.ac.currentTime;
  const osc = audio.ac.createOscillator();
  const gain = audio.ac.createGain();

  osc.type = audio.mode === "game" ? "triangle" : "sine";
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(audio.mode === "game" ? 0.045 : 0.07, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
  osc.connect(gain);
  gain.connect(audio.master);
  osc.start(now);
  osc.stop(now + 0.5);

  audio.index += 1;
  audio.nextNote = now + (audio.mode === "game" ? 0.55 : 0.42);
}

function toggleMute() {
  startAudio();
  if (!audio) return;
  audio.ac.resume?.();
  audio.muted = !audio.muted;
  audio.master.gain.value = audio.muted ? 0 : 0.12;
  updateMuteButtons();
}

function updateMuteButtons() {
  document.querySelectorAll(".sound-button").forEach((button) => {
    button.classList.toggle("is-muted", Boolean(audio?.muted));
    button.textContent = audio?.muted ? "♪̸" : "♪";
  });
}

function setMessage(text) {
  messageBox.textContent = text;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function inRect(point, rect) {
  return point.x > rect.x && point.x < rect.x + rect.w && point.y > rect.y && point.y < rect.y + rect.h;
}

function currentSafeZone() {
  if (state.insidePlace) return state.insidePlace;
  if (inRect(state.player, zones.secretHome)) return "secretHome";
  if (inRect(state.player, zones.treehouse)) return "treehouse";
  if (inRect(state.player, zones.car)) return "car";
  if (state.house >= 100 && inRect(state.player, zones.house)) return "house";
  return null;
}

function update(dt) {
  if (currentScreen !== "game" || state.gameOver || state.wonNight) return;

  const move = { x: 0, y: 0 };
  if (keys.has("arrowup") || keys.has("w") || touchDirs.has("up")) move.y -= 1;
  if (keys.has("arrowdown") || keys.has("s") || touchDirs.has("down")) move.y += 1;
  if (keys.has("arrowleft") || keys.has("a") || touchDirs.has("left")) move.x -= 1;
  if (keys.has("arrowright") || keys.has("d") || touchDirs.has("right")) move.x += 1;

  if (move.x || move.y) {
    if (state.insidePlace) {
      state.insidePlace = null;
      setMessage("You stepped back outside.");
    }
    const length = Math.hypot(move.x, move.y);
    state.player.x += (move.x / length) * state.player.speed * dt;
    state.player.y += (move.y / length) * state.player.speed * dt;
    state.player.x = Math.max(45, Math.min(world.width - 45, state.player.x));
    state.player.y = Math.max(155, Math.min(world.height - 70, state.player.y));
    state.safePlace = currentSafeZone();
  }

  if (!state.secretFound && distance(state.player, centerOf(zones.secretHome)) < 115) {
    state.secretFound = true;
    setMessage("You found the secret home in the backyard. Horror cannot find it.");
  }

  state.time += dt * GAME_MINUTES_PER_SECOND;
  if (state.time >= WARNING_TIME && !state.noticeShown) {
    state.noticeShown = true;
    setMessage("8:30 warning! Night is approaching. Find a safe place before 9:00.");
  }
  if (state.time >= NIGHT_TIME) {
    state.horror.active = true;
    setMusicMode("game");
    moveHorror(dt);
  }

  if (state.time >= SAFE_UNTIL_TIME && currentSafeZone() && hasNightSupplies()) {
    state.wonNight = true;
    setMessage("You stayed safe through the scary part of the night!");
  }

  if (state.horror.active && !currentSafeZone() && distance(state.player, state.horror) < 70) {
    state.gameOver = true;
    setMessage("Horror found you outside. Try again and get inside before 9:00.");
  }

  updateHud();
}

function hasNightSupplies() {
  const safe = currentSafeZone();
  return safe === "treehouse" || safe === "car" || safe === "secretHome" || state.food > 0 || state.house >= 100;
}

function centerOf(rect) {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

function moveHorror(dt) {
  const safe = currentSafeZone();
  if (safe) return;
  const dx = state.player.x - state.horror.x;
  const dy = state.player.y - state.horror.y;
  const len = Math.hypot(dx, dy) || 1;
  const speed = 76;
  state.horror.x += (dx / len) * speed * dt;
  state.horror.y += (dy / len) * speed * dt;
}

function collectNearby() {
  const found = state.resources.find((item) => !item.taken && distance(state.player, item) < 58);
  if (!found) {
    setMessage("Move closer to logs, apples, or berries to collect them.");
    return;
  }
  found.taken = true;
  if (found.type === "wood") {
    state.wood += 1;
    setMessage("Wood collected. Take it to the build area for the house.");
  } else {
    state.food += 1;
    setMessage("Food collected. Supplies help you stay safe at night.");
  }
  updateHud();
}

function buildHouse() {
  if (!inRect(state.player, zones.build)) {
    setMessage("Stand near the house frame to build.");
    return;
  }
  if (state.wood < 1) {
    setMessage("You need wood to build the house.");
    return;
  }
  state.wood -= 1;
  state.house = Math.min(100, state.house + 25);
  if (state.house >= 100) {
    state.insidePlace = "house";
    state.safePlace = "house";
    setMessage("The house is ready. You went inside and Horror cannot get you.");
  } else {
    setMessage("Nice building! Keep collecting wood.");
  }
  updateHud();
}

function enterSafePlace() {
  const safe = currentSafeZone();
  if (!safe) {
    if (inRect(state.player, zones.house) || inRect(state.player, zones.build)) {
      setMessage("Finish building the house first, then you can go inside.");
      return;
    }
    setMessage("Move into the treehouse, safe car, secret home, or finished house first.");
    return;
  }
  const names = { treehouse: "treehouse", car: "safe car", house: "house", secretHome: "secret home" };
  state.safePlace = safe;
  state.insidePlace = safe;
  if (hasNightSupplies()) {
    setMessage(`You are safe inside the ${names[safe]}.`);
  } else {
    setMessage(`The ${names[safe]} is shelter, but you still need food or supplies for the night.`);
  }
}

function updateHud() {
  const hour = Math.floor(state.time / 60);
  const minute = Math.floor(state.time % 60);
  gameClock.textContent = `${hour}:${String(minute).padStart(2, "0")}`;
  dayPhase.textContent = state.time < WARNING_TIME ? "Daylight" : state.time < NIGHT_TIME ? "Warning" : "Horror";
  woodCount.textContent = state.wood;
  foodCount.textContent = state.food;
  houseCount.textContent = `${state.house}%`;
  warningBanner.classList.toggle("is-visible", state.time >= WARNING_TIME && state.time < NIGHT_TIME);
}

function draw() {
  const dusk = Math.max(0, Math.min(1, (state.time - 19 * 60) / 130));
  const night = Math.max(0, Math.min(1, (state.time - WARNING_TIME) / 70));
  ctx.clearRect(0, 0, world.width, world.height);

  if (art.gameplay.complete && art.gameplay.naturalWidth) {
    drawImageCover(art.gameplay, 0, 0, world.width, world.height);
    if (night > 0) {
      ctx.fillStyle = `rgba(28, 19, 55, ${0.12 + night * 0.38})`;
      ctx.fillRect(0, 0, world.width, world.height);
    }
  } else {
    const sky = ctx.createLinearGradient(0, 0, 0, world.height);
    sky.addColorStop(0, mixColor("#ffb7dc", "#342653", dusk));
    sky.addColorStop(0.48, mixColor("#c883c7", "#5d3f82", dusk));
    sky.addColorStop(1, "#24352f");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, world.width, world.height);
    drawForest(night);
    drawGround();
    drawTreehouse();
    drawCar();
    drawBuildHouse();
  }

  drawSecretHome();
  drawBuildProgress();
  drawResources();
  drawHorror(night);
  drawPlayer();
  drawInsideBadge();

  if (state.gameOver || state.wonNight) drawEndPanel();
}

function drawImageCover(image, x, y, w, h) {
  const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (image.naturalWidth - sw) / 2;
  const sy = (image.naturalHeight - sh) / 2;
  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
}

function drawSecretHome() {
  const z = zones.secretHome;
  ctx.save();
  if (!state.secretFound && art.gameplay.complete && art.gameplay.naturalWidth) {
    ctx.globalAlpha = 0.22;
  }
  ctx.fillStyle = "rgba(37, 56, 38, 0.94)";
  roundRect(z.x - 18, z.y + 28, z.w + 36, 56, 24);
  ctx.fill();
  ctx.fillStyle = "#e96cab";
  for (let i = 0; i < 9; i += 1) {
    ellipse(z.x - 8 + i * 19, z.y + 32 + (i % 3) * 9, 10, 7);
  }
  ctx.fillStyle = "#7d5133";
  roundRect(z.x + 26, z.y + 40, 82, 38, 10);
  ctx.fill();
  ctx.fillStyle = "#ffd978";
  ellipse(z.x + 95, z.y + 59, 5, 5);
  ctx.strokeStyle = "rgba(255, 243, 198, 0.74)";
  ctx.lineWidth = 3;
  ctx.strokeRect(z.x + 32, z.y + 46, 70, 26);
  if (state.secretFound) {
    ctx.fillStyle = "rgba(255, 246, 225, 0.9)";
    ctx.font = "900 20px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText("Secret Home", z.x + z.w / 2, z.y + 18);
    ctx.textAlign = "start";
  }
  ctx.restore();
}

function drawBuildProgress() {
  const z = zones.house;
  ctx.save();
  ctx.fillStyle = "rgba(255, 247, 225, 0.86)";
  roundRect(z.x + 26, z.y + z.h + 10, 158, 26, 13);
  ctx.fill();
  ctx.fillStyle = "#9c5f38";
  roundRect(z.x + 34, z.y + z.h + 17, 142, 12, 6);
  ctx.fill();
  ctx.fillStyle = "#ef86bd";
  roundRect(z.x + 34, z.y + z.h + 17, 142 * (state.house / 100), 12, 6);
  ctx.fill();
  ctx.restore();
}

function drawForest(night) {
  for (let i = 0; i < 18; i += 1) {
    const x = i * 82 - 30;
    const h = 280 + (i % 4) * 45;
    ctx.fillStyle = night > 0.5 ? "rgba(34, 23, 53, 0.88)" : "rgba(83, 54, 78, 0.72)";
    roundRect(x, 105, 35, h, 18);
    ctx.fill();
    ctx.fillStyle = night > 0.5 ? "rgba(93, 54, 105, 0.75)" : "rgba(235, 92, 160, 0.82)";
    ellipse(x + 18, 108, 86, 52);
  }
}

function drawGround() {
  ctx.fillStyle = "#30452f";
  ctx.beginPath();
  ctx.ellipse(640, 665, 790, 220, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 217, 232, 0.35)";
  for (let i = 0; i < 48; i += 1) {
    ellipse((i * 91) % 1250, 520 + ((i * 37) % 150), 7, 4);
  }

  ctx.strokeStyle = "rgba(244, 219, 185, 0.42)";
  ctx.lineWidth = 26;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(520, 720);
  ctx.quadraticCurveTo(650, 540, 740, 420);
  ctx.quadraticCurveTo(820, 310, 960, 220);
  ctx.stroke();
}

function drawTreehouse() {
  const z = zones.treehouse;
  ctx.fillStyle = "#5a3728";
  roundRect(z.x + 50, z.y + 118, 28, 178, 8);
  ctx.fill();
  ctx.fillStyle = "#8f5a34";
  roundRect(z.x, z.y, z.w, z.h, 10);
  ctx.fill();
  ctx.fillStyle = "#4a2f25";
  triangle(z.x - 20, z.y + 18, z.x + z.w / 2, z.y - 56, z.x + z.w + 20, z.y + 18);
  ctx.fill();
  ctx.fillStyle = "#ffd879";
  roundRect(z.x + 60, z.y + 44, 40, 42, 6);
  ctx.fill();
  ctx.fillStyle = "#6b4028";
  for (let i = 0; i < 7; i += 1) {
    ctx.fillRect(z.x + 122, z.y + 137 + i * 18, 55, 6);
  }
}

function drawCar() {
  const z = zones.car;
  ctx.fillStyle = "#3b7b78";
  roundRect(z.x, z.y + 22, z.w, z.h - 22, 34);
  ctx.fill();
  ctx.fillStyle = "#9fd1cf";
  roundRect(z.x + 42, z.y, 82, 46, 20);
  ctx.fill();
  ctx.fillStyle = "#23242d";
  ellipse(z.x + 35, z.y + 84, 22, 22);
  ellipse(z.x + 128, z.y + 84, 22, 22);
  ctx.fillStyle = "#fff3b4";
  ellipse(z.x + 12, z.y + 54, 10, 8);
}

function drawBuildHouse() {
  const z = zones.house;
  const progress = state.house / 100;
  ctx.strokeStyle = "#9b673f";
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(z.x, z.y + z.h);
  ctx.lineTo(z.x, z.y + 50);
  ctx.lineTo(z.x + z.w / 2, z.y - 25);
  ctx.lineTo(z.x + z.w, z.y + 50);
  ctx.lineTo(z.x + z.w, z.y + z.h);
  ctx.stroke();

  ctx.globalAlpha = 0.35 + progress * 0.65;
  ctx.fillStyle = progress >= 1 ? "#b87947" : "#d8b27a";
  roundRect(z.x + 18, z.y + 60, z.w - 36, z.h - 60, 8);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#f9d66f";
  if (progress >= 1) roundRect(z.x + 78, z.y + 98, 48, 52, 5);
  ctx.fill();
}

function drawResources() {
  state.resources.forEach((item) => {
    if (item.taken) return;
    if (art.gameplay.complete && art.gameplay.naturalWidth) {
      ctx.save();
      ctx.globalAlpha = 0.88;
      ctx.strokeStyle = item.type === "wood" ? "#fff0b4" : "#ffd0ec";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(item.x, item.y, 27, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
      ellipse(item.x, item.y, 22, 12);
      ctx.restore();
      return;
    }
    if (item.type === "wood") {
      ctx.fillStyle = "#805332";
      roundRect(item.x - 28, item.y - 10, 56, 20, 10);
      ctx.fill();
      ctx.fillStyle = "#c79658";
      ellipse(item.x - 22, item.y, 8, 8);
    } else {
      ctx.fillStyle = item.x % 2 ? "#d84848" : "#6548a6";
      ellipse(item.x, item.y, 16, 16);
      ctx.fillStyle = "#5a8d48";
      ellipse(item.x + 10, item.y - 14, 9, 5);
    }
  });
}

function drawPlayer() {
  if (state.insidePlace) return;
  const p = state.player;
  const isMyra = selectedCharacter === "myra";
  const sprite = isMyra ? art.myra : art.ivu;
  ctx.fillStyle = "rgba(30, 20, 40, 0.24)";
  ellipse(p.x, p.y + 31, 34, 12);
  if (sprite.complete && sprite.naturalWidth) {
    const spriteH = isMyra ? 118 : 112;
    const spriteW = (sprite.naturalWidth / sprite.naturalHeight) * spriteH;
    ctx.drawImage(sprite, p.x - spriteW / 2, p.y + 35 - spriteH, spriteW, spriteH);
    return;
  }
  ctx.fillStyle = isMyra ? "#8650b0" : "#5d8f57";
  roundRect(p.x - 18, p.y - 5, 36, 48, 16);
  ctx.fill();
  ctx.fillStyle = "#ffd0a7";
  ellipse(p.x, p.y - 28, 24, 24);
  ctx.fillStyle = "#5b3428";
  ellipse(p.x, p.y - 40, 27, 17);
  if (isMyra) {
    ctx.fillStyle = "#ff83bd";
    ellipse(p.x + 6, p.y - 51, 15, 7);
  }
}

function drawInsideBadge() {
  if (!state.insidePlace) return;
  const labels = {
    treehouse: "Inside Treehouse",
    car: "Inside Safe Car",
    house: "Inside House",
    secretHome: "Inside Secret Home",
  };
  const safe = state.insidePlace;
  const anchor = safe === "car"
    ? centerOf(zones.car)
    : safe === "treehouse"
      ? centerOf(zones.treehouse)
      : safe === "secretHome"
        ? centerOf(zones.secretHome)
        : centerOf(zones.house);
  ctx.save();
  ctx.fillStyle = "rgba(255, 247, 225, 0.92)";
  roundRect(anchor.x - 88, anchor.y - 24, 176, 42, 18);
  ctx.fill();
  ctx.fillStyle = "#5c315b";
  ctx.font = "900 18px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText(labels[safe], anchor.x, anchor.y + 3);
  ctx.textAlign = "start";
  ctx.restore();
}

function drawHorror(night) {
  if (!state.horror.active && night < 0.8) return;
  const h = state.horror;
  ctx.save();
  ctx.globalAlpha = state.horror.active ? 0.76 : 0.25;
  ctx.fillStyle = "#17111f";
  ctx.beginPath();
  ctx.moveTo(h.x, h.y - 66);
  ctx.bezierCurveTo(h.x - 45, h.y - 38, h.x - 36, h.y + 70, h.x - 68, h.y + 96);
  ctx.quadraticCurveTo(h.x, h.y + 75, h.x + 68, h.y + 96);
  ctx.bezierCurveTo(h.x + 36, h.y + 68, h.x + 42, h.y - 38, h.x, h.y - 66);
  ctx.fill();
  ctx.fillStyle = "#ff5aa0";
  ellipse(h.x - 14, h.y - 20, 8, 12);
  ellipse(h.x + 14, h.y - 20, 8, 12);
  if (state.horror.active) {
    ctx.fillStyle = "rgba(255, 246, 225, 0.9)";
    ctx.font = "900 22px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText("Horror", h.x, h.y - 86);
    ctx.textAlign = "start";
  }
  ctx.restore();
}

function drawEndPanel() {
  ctx.fillStyle = "rgba(26, 17, 39, 0.68)";
  ctx.fillRect(0, 0, world.width, world.height);
  ctx.fillStyle = "#fff6df";
  roundRect(370, 230, 540, 210, 26);
  ctx.fill();
  ctx.fillStyle = "#513154";
  ctx.textAlign = "center";
  ctx.font = "900 42px Trebuchet MS";
  ctx.fillText(state.wonNight ? "Safe until morning!" : "Try again", 640, 306);
  ctx.font = "800 22px Trebuchet MS";
  ctx.fillText(state.wonNight ? "Horror stayed outside." : "Get inside before 9:00.", 640, 352);
  ctx.fillText("Press Enter to restart.", 640, 392);
  ctx.textAlign = "start";
}

function mixColor(a, b, t) {
  const ah = parseInt(a.slice(1), 16);
  const bh = parseInt(b.slice(1), 16);
  const ar = ah >> 16;
  const ag = (ah >> 8) & 0xff;
  const ab = ah & 0xff;
  const br = bh >> 16;
  const bg = (bh >> 8) & 0xff;
  const bb = bh & 0xff;
  const rr = ar + t * (br - ar);
  const rg = ag + t * (bg - ag);
  const rb = ab + t * (bb - ab);
  return `rgb(${rr}, ${rg}, ${rb})`;
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  const radius = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
}

function ellipse(x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function triangle(x1, y1, x2, y2, x3, y3) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.closePath();
}

function loop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

bindPress(document.getElementById("playButton"), () => showScreen("choose"));
document.querySelectorAll(".character-card").forEach((card) => {
  bindPress(card, () => resetGame(card.dataset.character));
});
document.querySelectorAll(".sound-button").forEach((button) => bindPress(button, toggleMute));
bindPress(document.getElementById("collectButton"), collectNearby);
bindPress(document.getElementById("buildButton"), buildHouse);
bindPress(document.getElementById("enterButton"), enterSafePlace);

document.querySelectorAll(".dpad button").forEach((button) => {
  const dir = button.dataset.dir;
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    touchDirs.add(dir);
  });
  button.addEventListener("pointerup", () => touchDirs.delete(dir));
  button.addEventListener("pointercancel", () => touchDirs.delete(dir));
  button.addEventListener("lostpointercapture", () => touchDirs.delete(dir));
});

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  keys.add(key);
  if (event.key === " " || key === "e") {
    event.preventDefault();
    collectNearby();
  }
  if (key === "b") buildHouse();
  if (key === "f") enterSafePlace();
  if (event.key === "Enter" && (state.gameOver || state.wonNight)) resetGame(selectedCharacter);
});

window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
window.addEventListener("blur", () => {
  keys.clear();
  touchDirs.clear();
});

makeResources();
updateHud();
requestAnimationFrame(loop);
