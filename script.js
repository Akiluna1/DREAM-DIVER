// === Framerate-unabhängige Zeitsteuerung für das gesamte Spiel ===
let lastTime = performance.now();


/**
 * Hauptdatei für das Traumspiel.
 * -----------------------------------
 * Dieses Spiel simuliert einen abstrakten Traum, in dem der/die Spieler:in durch verschiedene Phasen steuert:
 * 1. Wörter auswählen, die den Traum beeinflussen.
 * 2. Je nach Auswahl ein Minispiel (Albtraum: Ausweichen, Guter Traum: Piano).
 * 3. Zweite Wortauswahl und erneutes Minispiel.
 * 4. Am Ende werden beide Minispiele ausgewertet und ein Endscreen zeigt das Ergebnis an.
 *
 * Die Spiellogik steuert das Wechseln zwischen den Phasen, das Zeichnen und Bewegen auf dem Canvas,
 * die Steuerung, die Anzeige von Anweisungen und die Musik-/Soundeffekte.
 */
const backgroundVideo = document.getElementById("backgroundVideo");
const pianoBackgroundVideo = document.getElementById("pianoBackgroundVideo");
// === Piano-Hintergrundvideo Steuerung ===
function showPianoBackgroundVideo() {
  if (pianoBackgroundVideo) {
    pianoBackgroundVideo.style.display = "block";
    pianoBackgroundVideo.play().catch(e => console.warn("Piano-Video blockiert", e));
  }
}

function hidePianoBackgroundVideo() {
  if (pianoBackgroundVideo) {
    pianoBackgroundVideo.pause();
    pianoBackgroundVideo.style.display = "none";
  }
}
window.addEventListener("DOMContentLoaded", () => {
  if (backgroundVideo) {
    backgroundVideo.muted = true;
    backgroundVideo.play().catch(e => console.warn("Autoplay blockiert:", e));
    fadeInAudio(startMusic); // Startmusik ausblenden
fadeOutAudio(endMusic);   // Endmusik ausblenden
  }
});

// === Initialisierung von Canvas und DOM-Elementen ===
const canvas = document.getElementById("gameCanvas"); // Hauptspielfläche
const ctx = canvas.getContext("2d"); // 2D-Kontext zum Zeichnen
const container = document.getElementById("game"); // Container für CSS-Background-Klassen

// Funktion für responsives Anpassen der Canvas-Größe
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas(); // Direkt initialisieren
window.addEventListener("resize", resizeCanvas); // Bei Fensteränderung anpassen

// Hintergrund-Video DOM-Element wurde bereits oben geladen

// === Hintergrundvideo Sichtbarkeit steuern ===
function showBackgroundVideo() {
  if (backgroundVideo) backgroundVideo.style.display = "block";
}
function hideBackgroundVideo() {
  if (backgroundVideo) backgroundVideo.style.display = "none";
}

// Buttons und Anzeigen
const startButton = document.getElementById("startButton");
const gameTitle = document.getElementById("gameTitle");
const resultDiv = document.getElementById("result"); // Anzeige der gewählten Wörter

// Anweisungsfeld für Spielphasen
const instructionDiv = document.createElement('div');
instructionDiv.id = 'instructionText';
instructionDiv.style.cssText = "position:fixed;top:20px;left:50%;transform:translateX(-50%);color:white;font-family:'argent-pixel-cf',sans-serif;font-size:40px;text-align:center;z-index:100;text-shadow: 0 0 8px #ffffff;";
document.body.appendChild(instructionDiv);

// Canvas und Ergebnisanzeige zu Beginn ausblenden
canvas.style.display = 'none';
resultDiv.style.display = 'none';

// Endscreen-Div für die Gesamtauswertung am Ende
const endscreenDiv = document.createElement('div');
endscreenDiv.id = 'endScreen';
endscreenDiv.style.cssText = "display:none;position:fixed;top:0;left:0;right:0;bottom:0;text-align:center;font-size:2.2em;padding-top:15vh;z-index:50";
document.body.appendChild(endscreenDiv);

// === SPIELZUSTANDS-VARIABLEN ===
// Merken, wie die Minigames ausgegangen sind (true=geschafft, false=verloren)
let miniGameResult1 = null; // Ergebnis 1. Minispiel
let miniGameResult2 = null; // Ergebnis 2. Minispiel
let isSecondMinigame = false; // Steuert, ob im zweiten Minispiel
let animationFrameId; // Damit wir die Animationsschleife später abbrechen können
// On-Canvas Message State für temporäre Nachrichten
let canvasMessage = null;
let messageTimer = 0;
let messageCallback = null;
let messageActive = false;
// Für pulsierenden Glow-Effekt der Spielfigur
let glowAngle = 0;

// Wörter aus der ersten Auswahl speichern (für zweite Auswahl)
let phase1Collected = [];

// Spielerfigur (weißer Kreis mit Glow)
let player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  size: 20,
  speed: 6,
  scale: 1,
  scaleTarget: 1,
  color: "#ffffff",  // Abstrakte, traumhafte Figur
  trail: [] // Für Nachleucht-Effekt
};

let words = [];     // Aktuelle Wortobjekte auf dem Spielfeld
let collected = []; // Bereits eingesammelte Wörter

// === SOUNDS UND MUSIK ===
const wordCollectSound = new Audio("WORDCOLLECT.mp3");      // Wort eingesammelt
const gameStartSound = new Audio("GAMESTART.mp3");          // Startsound für Übergänge
const startMusic = new Audio("STARTMUSIC.mp3");             // Musik beim Startscreen
startMusic.loop = true;
const wordMusic = new Audio("WORDMUSIC.mp3");               // Musik während Wortauswahl
wordMusic.loop = true;
const endMusic = new Audio("ENDMUSIC.mp3");                 // Musik beim Endscreen
endMusic.loop = true;
// Piano-Minispiel-Sounds
const noteCollectSound = new Audio("NOTECOLLECT.mp3");
const noteMissedSound = new Audio("NOTEMISSED.mp3");
const pianoStartSound = new Audio("PIANOSTART.mp3");
const pianoLoop1 = new Audio("PIANOGAME.mp3");
const pianoLoop2 = new Audio("PIANOGAME1.mp3");
pianoLoop1.loop = true;
pianoLoop2.loop = true;

// Wortpool mit Typ (gut/schlecht)
const wordPool = [
  { text: "Liebe", type: "good" },
  { text: "Verlust", type: "bad" },
  { text: "Freiheit", type: "good" },
  { text: "Angst", type: "bad" },
  { text: "Licht", type: "good" },
  { text: "Dunkel", type: "bad" }
];

let keys = {}; // Aktueller Zustand der gedrückten Tasten
let gameFinished = false; // true, wenn Minigame läuft und Wortauswahl pausiert


/**
 * Startet die Wortauswahl-Phase (entweder erste oder zweite Runde).
 * Initialisiert Spielerposition, blendet Musik ein, setzt Wörter auf das Spielfeld.
 */
function startGame() {
  if (typeof animationFrameId !== "undefined") {
    cancelAnimationFrame(animationFrameId);
  }

  // Hintergrundvideo anzeigen, wenn Wortspiel/Startscreen aktiv
  showBackgroundVideo();

  player.speed = 6;
  keys = {}; // Leert das gedrückte-Tasten-Objekt

  // Event Listener neu registrieren, um doppelte Bewegung zu vermeiden
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  player.speed = 6; // Spieler-Geschwindigkeit zurücksetzen
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
  fadeOutAudio(startMusic); // Startmusik ausblenden
  fadeOutAudio(endMusic);   // Endmusik ausblenden
  fadeInAudio(wordMusic);   // Musik für Wortphase einblenden
  wordMusic.currentTime = 0;
  container.classList.remove('bg-main','bg-piano','bg-dodge');
  container.classList.add('bg-main');
  canvas.style.display = 'block';
  // Anzeige zurücksetzen
  resultDiv.innerHTML = '';
  resultDiv.style.display = 'block';
  endscreenDiv.style.display = "none";
  // Wörter und Spieler für neue Auswahl zurücksetzen
  collected = [];
  player.x = canvas.width / 2;
  player.y = canvas.height / 2;
  gameFinished = false;

  instructionDiv.innerHTML = '';
  instructionDiv.style.display = 'block';
  setTimeout(() => {
    instructionDiv.innerHTML = "Noch 3 Wörter wählen…";
  }, 50);

  // In der zweiten Runde nur noch Wörter anzeigen, die noch nicht gewählt wurden
  const available = miniGameResult1 === null
    ? wordPool
    : wordPool.filter(w => !phase1Collected.includes(w.text));
  words = available.map(word => ({
    ...word,
    x: Math.random() * (canvas.width - 160) + 80,
    y: Math.random() * (canvas.height - 100) + 50,
    alpha: 1
  }));

  // Listener für Steuerung hinzufügen (falls notwendig)
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // Startet die Hauptspiel-Schleife (Wortauswahl, Bewegung, Kollisionen)
  animationFrameId = requestAnimationFrame(gameLoop);
}

/**
 * Zeichnet die Spielerfigur (weißer Kreis mit Glow und Nachleuchtspur)
 */
function drawPlayer() {
  // Trail (Nachleucht-Effekt)
  player.trail.forEach((p, index) => {
    // Neueste Spur am hellsten
    const alpha = (index / (player.trail.length - 1 || 1)) * 0.5;
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, player.size, 0, Math.PI * 2);
    ctx.fill();
  });

  // Hauptspieler mit Glow
  ctx.save();
  ctx.shadowColor = "#ffffff";
  const blur = 10 + 10 * Math.abs(Math.sin(glowAngle));
  ctx.shadowBlur = blur;
  ctx.translate(player.x, player.y);
  ctx.scale(player.scale, player.scale);
  ctx.fillStyle = player.color;
  ctx.beginPath();
  ctx.arc(0, 0, player.size, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  player.scale += (player.scaleTarget - player.scale) * 0.1;

  // Position zur Trailspur hinzufügen
  player.trail.push({ x: player.x, y: player.y });
  if (player.trail.length > 25) player.trail.shift();  // Maximal 15 Elemente
}

/**
 * Zeichnet die Wörter auf das Spielfeld (fade-out beim Einsammeln)
 */
function drawWords() {
  ctx.font = "35px 'pixelify-sans'";
  ctx.textBaseline = "middle";
  words.forEach((word, i) => {
    ctx.save();
    ctx.globalAlpha = word.alpha;
    ctx.fillStyle = "#fff";
    ctx.fillText(word.text, word.x, word.y);
    ctx.restore();

    // Blende Wort aus, wenn eingesammelt (im Array collected)
    if (collected.includes(word) && word.alpha < 1) {
      word.alpha -= 0.08;
      if (word.alpha <= 0) {
        words.splice(i, 1);
      }
    }
  });
}


/**
 * Bewegt die Spielfigur entsprechend gedrückter Tasten (zeitbasiert)
 * @param {number} deltaTime - Zeit seit letztem Frame in Sekunden
 */
function updatePlayer(deltaTime) {
  // Spieler-Geschwindigkeit in Pixel pro Sekunde
  const playerSpeed = 150;
  if (keys["ArrowLeft"] && player.x - player.size > 0) player.x -= playerSpeed * deltaTime;
  if (keys["ArrowRight"] && player.x + player.size < canvas.width) player.x += playerSpeed * deltaTime;
  if (keys["ArrowUp"] && player.y - player.size > 0) player.y -= playerSpeed * deltaTime;
  if (keys["ArrowDown"] && player.y + player.size < canvas.height) player.y += playerSpeed * deltaTime;
}

/**
 * Prüft, ob die Spielfigur ein Wort eingesammelt hat (Kollisionserkennung)
 * Wenn 3 Wörter gesammelt sind, wird die Auswertung gestartet.
 */
function checkCollisions() {
  if (collected.length >= 3) return;

  for (let i = words.length - 1; i >= 0; i--) {
    const word = words[i];
    ctx.font = "20px 'pixelify-sans'";
    const textWidth = ctx.measureText(word.text).width;
    const wordCenterX = word.x + textWidth / 2;
    const wordCenterY = word.y;
    const dx = player.x - wordCenterX;
    const dy = player.y - wordCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < player.size + 35 && word.alpha === 1 && !collected.includes(word)) {
      // Sound abspielen (Klon für paralleles Abspielen)
      const collectSound = wordCollectSound.cloneNode();
      collectSound.play().catch(e => console.log("Sound play error:", e));
      collected.push(word);
      word.alpha = 0.99;
      player.scaleTarget = 1.5;
      setTimeout(() => { player.scaleTarget = 1; }, 100);

      if (collected.length === 3) {
        if (!gameFinished) evaluateResult();
      }
      break;
    }
  }
}


/**
 * Aktualisiert die Anzeige der bereits gesammelten Wörter und blendet Hinweise ein
 */
function updateResultDisplay() {
  if (messageActive) return;
  if (collected.length === 0) return; // Initialhinweis nicht überschreiben
  const remaining = 3 - collected.length;
  if (remaining > 0) {
    instructionDiv.innerHTML = `Noch ${remaining} ${remaining === 1 ? "Wort" : "Wörter"} wählen…`;
  }
  const collectedText = collected.map(w => w.text).join(", ");
  resultDiv.innerHTML = `<div style="font-size:40px; text-shadow: 0 0 8px #ffffff;">${collectedText}</div>`;
  // Stil für Anzeige
  resultDiv.style.fontFamily = "'pixelify-sans', sans-serif";
  resultDiv.style.color = "#ffffff";

  // Pulsierende Hintergrundfarbe als Feedback
  if (collected.length > 0) {
    const intensity = Math.min(50, collected.length * 10);
    document.body.style.backgroundColor = `rgb(${220 - intensity}, ${230 - intensity}, ${250 - intensity})`;
  }
}

/**
 * Auswertung nach jeder Wortauswahl-Phase:
 * - Entscheidet, welches Minigame als nächstes kommt (je nach Anzahl "bad"-Wörter)
 * - Merkt sich die Ergebnisse in miniGameResult1/2
 * - Startet ggf. automatisch die zweite Runde
 */
function evaluateResult() {
  if (gameFinished) return;
  let badWords = collected.filter(w => w.type === "bad").length;

  if (collected.length === 3) {
    if (miniGameResult1 === null) {
      // Nach der ersten Wortauswahl
      if (badWords >= 2) {
        // Zu viele schlechte Wörter: Dodge-Minispiel (Albtraum)
        miniGameResult1 = false;
        phase1Collected = collected.map(w => w.text);
        // Ablauf wie vor der "showMessage"-Einführung: direkt fadeToMiniGame mit Texten
        fadeToMiniGame("Gebe dein bestes um nicht aufzuwachen...", () => {
            startMiniGame("dodge");
        });
      } else {
        // Wenig "bad": Piano-Minispiel (guter Traum)
        miniGameResult1 = true;
        phase1Collected = collected.map(w => w.text);
        // Ablauf wie vor der "showMessage"-Einführung: direkt fadeToMiniGame mit Texten
        fadeToMiniGame("Gebe dein bestes um nicht aufzuwachen...", () => {
          startMiniGame("catch");
        });
      }
    } else if (miniGameResult2 === null) {
      // Nach der zweiten Wortauswahl: anderes Minigame
      isSecondMinigame = true;
      // Ablauf wie vor der "showMessage"-Einführung: direkt fadeToMiniGame
      if (miniGameResult1) {
        fadeToMiniGame("Es wird gefärlich… Vorsicht...", startDodgeMiniGame, '#001024');
      } else {
        fadeToMiniGame("Die Wellen werden dich beruhigen...", startGoodDreamMiniGame, '#45B7B7');
      }
    }
  }

  // Automatischer Start der zweiten Runde, wenn 6 Wörter insgesamt gesammelt
  if (miniGameResult1 !== null && miniGameResult2 === null && collected.length === 6) {
    setTimeout(() => {
      startGame();
    }, 1500);
  }
}

// Neue Hilfsfunktion, um das passende Minigame nach den Messages zu starten
function startMiniGame(type) {
  if (type === "dodge") {
    fadeToMiniGame("Vorsicht... Hörst du das Bröckeln...", startDodgeMiniGame, '#001024');
  } else if (type === "catch") {
    fadeToMiniGame("Es riecht nach Meer...", startGoodDreamMiniGame, '#45B7B7');
  }
}

/**
 * Hauptspiel-Schleife während der Wortauswahl-Phasen (zeitbasiert).
 * Zeichnet Spielfigur, Wörter, prüft Kollisionen und aktualisiert Anzeigen.
 * Wird per requestAnimationFrame kontinuierlich aufgerufen.
 * @param {number} currentTime - Zeitstempel von requestAnimationFrame
 */
function gameLoop(currentTime) {
  const deltaTime = (currentTime - lastTime) / 1000; // Sekunden
  lastTime = currentTime;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  updatePlayer(deltaTime);
  drawPlayer();
  drawWords();
  checkCollisions();

  // Anzeige der gesammelten Wörter aktualisieren
  updateResultDisplay();

  // Glow-Effekt animieren
  glowAngle += 0.05;

  // Schleife fortsetzen (solange Spiel in dieser Phase)
  animationFrameId = requestAnimationFrame(gameLoop);
}


// === TASTENSTEUERUNG ===
// Merkt gedrückte Tasten für Spielfigur etc.
function onKeyDown(e) { keys[e.key] = true; }
function onKeyUp(e) { keys[e.key] = false; }

// === STARTBUTTON-Logik ===
// Beim Klick auf "Start" wird das Spiel (Wortauswahl) gestartet, Musik eingeblendet, Intro-Overlay gezeigt
startButton.addEventListener("click", () => {
  startMusic.currentTime = 0;
  startMusic.play().catch(e => console.log("STARTMUSIC play error:", e));
  fadeInAudio(startMusic);

  fadeOutAudio(startMusic);
  fadeOutAudio(endMusic);
  fadeOutAudio(wordMusic);
  gameTitle.style.display = 'none';
  startButton.style.display = 'none';

  // Hintergrundvideo abspielen (Autoplay kann geblockt werden)
  if (backgroundVideo) {
    backgroundVideo.play().catch(e => console.log("Autoplay blockiert", e));
  }

  // Intro-Overlay mit Anweisung
  fadeToMiniGame("Tauche ein in deinen Traum.<br><br>Wähle drei Worte, die dich leiten _", () => {
    canvas.style.display = 'block';
    resultDiv.style.display = 'block';
    container.classList.remove('bg-main','bg-piano','bg-dodge');
    container.classList.add('bg-main');
    startGame();
  }, '#000000');
});

// Spielstart auch mit Leertaste möglich, falls Startbutton sichtbar
window.addEventListener("keydown", (e) => {
  if (e.code === "Space" && startButton.style.display !== 'none') {
    startButton.click();
  }
});


// --- BAD DREAM MINIGAME ---
/**
 * Startet das "Dodge"-Minispiel (Albtraum): Spieler muss herabfallenden Objekten ausweichen.
 * Enthält eigene Spiellogik, Steuerung, Kollisionen, Timer und Musik.
 */
let dodgeStartSound = null; // global, damit in fadeToMiniGame zugänglich
function startDodgeMiniGame() {
    // Hintergrundvideo ausblenden für Minigame
    hideBackgroundVideo();
    fadeOutAudio(wordMusic);

    // === WARMUP-ANZEIGE VOR DEM MINIGAME ===
    let warmupTime = 90;
    let warmup = true;
    // Wir brauchen Zugriff auf dodgeGameLoop und spawnFallingObject innerhalb von dodgeWarmupTick
    let dodgeGameLoopAudio = null;
    let fallingObjects = [];
    let dodgeScore = 0;
    let dodgeGameOver = false;
    let lastObjectTime = 0;
    let startTime = null;
    let warningUntil = null;
    let isGameStarted = false;
    let leftDown = false, rightDown = false, upDown = false, downDown = false;
    let dodgePlayer = {
        x: canvas.width / 2,
        y: canvas.height - 50,
        size: 25,
        speed: 10
    };
    function keyDown(e){
        if (e.key === "ArrowLeft") leftDown = true;
        if (e.key === "ArrowRight") rightDown = true;
        if (e.key === "ArrowUp") upDown = true;
        if (e.key === "ArrowDown") downDown = true;
    }
    function keyUp(e){
        if (e.key === "ArrowLeft") leftDown = false;
        if (e.key === "ArrowRight") rightDown = false;
        if (e.key === "ArrowUp") upDown = false;
        if (e.key === "ArrowDown") downDown = false;
    }
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);

    // Setup Audio
    if (!dodgeStartSound) {
        dodgeStartSound = new Audio("DODGESTART.mp3");
    }
    const gameCountdownSound = new Audio("GAMECOUNTDOWN.mp3");
    dodgeGameLoopAudio = new Audio("DODGEGAME.mp3");
    dodgeGameLoopAudio.loop = true;
    gameCountdownSound.play().catch(e => console.log("GAMECOUNTDOWN error", e));
    playLoop(dodgeGameLoopAudio);

    container.classList.remove('bg-main','bg-piano','bg-dodge');
    container.classList.add('bg-dodge');
    instructionDiv.style.display = 'none';
    instructionDiv.innerHTML = '';
    collected = [];
    resultDiv.style.display = 'none';
    gameFinished = true;

    // Dummy for spawnFallingObject, call when game startet
    function spawnFallingObject() {
        // Wird im eigentlichen Minigame verwendet; hier leer
    }

    // Die eigentliche Minigame-Schleife (aus dem alten gameTick übernommen)
    function dodgeGameLoop(timestamp) {
        glowAngle += 0.1;
        if (!startTime) startTime = timestamp;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let elapsed = timestamp - startTime;
        let GAME_DURATION = 30 * 1000;
        let timeLeft = Math.max(0, GAME_DURATION - elapsed);
        let secondsLeft = Math.ceil(timeLeft / 1000);
        // Spieler bewegen
        if (leftDown) dodgePlayer.x -= dodgePlayer.speed;
        if (rightDown) dodgePlayer.x += dodgePlayer.speed;
        if (upDown) dodgePlayer.y -= dodgePlayer.speed;
        if (downDown) dodgePlayer.y += dodgePlayer.speed;
        dodgePlayer.x = Math.max(dodgePlayer.size, Math.min(canvas.width - dodgePlayer.size, dodgePlayer.x));
        dodgePlayer.y = Math.max(dodgePlayer.size, Math.min(canvas.height - dodgePlayer.size, dodgePlayer.y));
        // Spieler zeichnen mit Glow
        ctx.save();
        ctx.shadowColor = "#ffffff";
        const blur = 10 + 10 * Math.abs(Math.sin(glowAngle));
        ctx.shadowBlur = blur;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(dodgePlayer.x, dodgePlayer.y, dodgePlayer.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // FallingObjects
        let difficultyLevel = 1 + dodgeScore / 500;
        let spawnDelay = Math.max(250, 700 - dodgeScore);
        let objectsToSpawn = 1;
        if (dodgeScore > 600) objectsToSpawn = 2;
        if (dodgeScore > 1500) objectsToSpawn = 3;
        if (!lastObjectTime || timestamp - lastObjectTime > spawnDelay) {
            lastObjectTime = timestamp;
            for(let i=0; i<objectsToSpawn; i++) {
                fallingObjects.push({
                    x: Math.random() * (canvas.width - 40) + 20,
                    y: -30,
                    size: 25 + Math.random() * 10,
                    speed: (7.5 + Math.random() * 2.9) * difficultyLevel
                });
            }
            // WOOSH-Sound beim Erscheinen eines Objekts
            const wooshSounds = ["WOOSH.mp3", "WOOSH1.mp3"];
            const wooshSound = new Audio(wooshSounds[Math.floor(Math.random() * wooshSounds.length)]);
            wooshSound.play().catch(e => console.log("WOOSH error", e));
        }
        // Move & Draw
        for (let obj of fallingObjects) {
            obj.y += obj.speed;
            const jitterX = (Math.random() - 0.5) * 4;
            const jitterY = (Math.random() - 0.5) * 1;
            ctx.save();
            ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
            ctx.shadowBlur = 20;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 10;
            ctx.fillStyle = "#e0eeee";
            ctx.beginPath();
            ctx.arc(obj.x + jitterX, obj.y + jitterY, obj.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        // Collision?
        for (let obj of fallingObjects) {
            let dx = obj.x - dodgePlayer.x;
            let dy = obj.y - dodgePlayer.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < obj.size + dodgePlayer.size) {
                dodgeGameOver = true;
            }
        }
        fallingObjects = fallingObjects.filter(obj => obj.y < canvas.height + obj.size);
        dodgeScore++;
        ctx.fillStyle = "#fff"; ctx.font = "24px pixelify-sans";
        ctx.fillText("Punkte: " + dodgeScore, 20, 40);
        ctx.fillStyle = "#fff"; ctx.font = "32px pixelify-sans";
        ctx.fillText(`Zeit: ${secondsLeft}s`, canvas.width/2 - 60, 40);
        // Sieg nach Ablauf der Zeit!
        if (timeLeft <= 0) {
            const gameWinSound = new Audio("GAMEWIN.mp3");
            gameWinSound.play().catch(e => console.log("GAMEWIN error", e));
            fadeOutAudio(dodgeGameLoopAudio);
            if (!isSecondMinigame) {
                miniGameResult1 = true;
                fadeToMiniGame("Puh geschafft, das war gefährlich…", () => {
                fadeToMiniGame("Wähle drei Worte, die dich leiten _<br><br>Vielleicht wird dein Traum ein anderer...", () => {  
                startGame(); // Startet die zweite Runde mit Phase 1 Wörtern
                    });
                });

                
            } else {
                miniGameResult2 = true;
                isSecondMinigame = false;
                fadeToMiniGame("Puh geschafft, das war gefährlich…", showEndScreenIfDone);
            }
            container.classList.remove('bg-main','bg-piano','bg-dodge');
            container.classList.add('bg-main');
            return;
        }
        if (!dodgeGameOver) {
            requestAnimationFrame(dodgeGameLoop);
        } else {
            window.removeEventListener("keydown", keyDown);
            window.removeEventListener("keyup", keyUp);
            setTimeout(() => {
                const gameOverSound = new Audio("GAMEOVER.mp3");
                gameOverSound.play().catch(e => console.log("GAMEOVER error", e));
                if (!isSecondMinigame) {
                    miniGameResult1 = false;
                  
                  fadeToMiniGame("Hätte besser laufen können…",() => {
                  fadeToMiniGame("Wähle drei Worte, die dich leiten _<br><br>Vielleicht wird dein Traum ein anderer...", () => {  
                  startGame(); 
                    });
                    });
                } else {
                    miniGameResult2 = false;
                    isSecondMinigame = false;
                    fadeToMiniGame("Hätte besser laufen können…", showEndScreenIfDone);
                }
            }, 50);
            fadeOutAudio(dodgeGameLoopAudio);
        }
    }

    // Der Warmup-Tick
    function dodgeWarmupTick() {
      if (warmup) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.textAlign = "center";
        const alpha = warmupTime > 60 ? 1 : (warmupTime < 0 ? 1 : warmupTime / 60);
        ctx.globalAlpha = alpha;
        ctx.font = "bold 32px pixelify-sans";
        ctx.fillStyle = "#fff";
        ctx.fillText("WARM UP!", canvas.width / 2, canvas.height / 2 - 40);
        ctx.font = "24px pixelify-sans";
        ctx.fillText("Beweg den Joystick in verschiedene Richtungen", canvas.width / 2, canvas.height / 2 + 10);
        ctx.globalAlpha = 1;
        warmupTime--;

        // Spielerbewegung im Warmup zulassen
        if (leftDown)  dodgePlayer.x -= dodgePlayer.speed;
        if (rightDown) dodgePlayer.x += dodgePlayer.speed;
        if (upDown)    dodgePlayer.y -= dodgePlayer.speed;
        if (downDown)  dodgePlayer.y += dodgePlayer.speed;
        dodgePlayer.x = Math.max(dodgePlayer.size, Math.min(canvas.width - dodgePlayer.size, dodgePlayer.x));
        dodgePlayer.y = Math.max(dodgePlayer.size, Math.min(canvas.height - dodgePlayer.size, dodgePlayer.y));
        // Spieler zeichnen
        ctx.save();
        ctx.shadowColor = "#ffffff";
        const blur = 10 + 10 * Math.abs(Math.sin(glowAngle));
        ctx.shadowBlur = blur;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(dodgePlayer.x, dodgePlayer.y, dodgePlayer.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (warmupTime === 60) {
          // Beispiel: Beginne mit dem Spiel oder Spawn
          // spawnFallingObject(); // Hier ggf. eigentliche Spiellogik
        }

        if (warmupTime <= 0) {
          warmup = false;
          requestAnimationFrame(dodgeGameLoop); // Starte Spiel-Loop nach Warmup
        } else {
          requestAnimationFrame(dodgeWarmupTick);
        }
      }
    }
    dodgeWarmupTick(); // Starte den Warmup-Ablauf
    return; // Beende startDodgeMiniGame() frühzeitig, um Warmup laufen zu lassen
}




// --- GOOD DREAM MINI GAME ---
/**
 * Startet das "Good Dream"-Minispiel (Piano): Spieler muss Noten im richtigen Moment treffen.
 * Enthält eigene Spiellogik, Steuerung, Noten- und Partikel-Animation.
 */
function startGoodDreamMiniGame() {
    // Hintergrundvideo ausblenden für Minigame, Piano-Video zeigen
    hideBackgroundVideo();
    showPianoBackgroundVideo();
    fadeOutAudio(wordMusic);
    // --- Play piano intro and loop ---
    pianoStartSound.currentTime = 0;
    pianoStartSound.play().catch(e => console.log("PIANOSTART error", e));
    setTimeout(() => {
      pianoLoop1.currentTime = 0;
      pianoLoop2.currentTime = 0;
      pianoLoop1.play().catch(e => console.log("PIANOGAME error", e));
      scheduleNotesToBeat();
      pianoLoop2.play().catch(e => console.log("PIANOGAME1 error", e));
      showGameStats();
    }, 1500);

    // Hide and clear resultDiv at the top of the function
    instructionDiv.innerHTML = '';
    resultDiv.style.display = 'none';
    resultDiv.innerHTML = '';
    // Pause das Wortspiel während des Minigames
    gameFinished = true;
    instructionDiv.style.display = 'none';
    instructionDiv.innerHTML = '';
    // Timer und Trefferanzeige schon zu Beginn sichtbar machen
    
    const noteLanes = 4;
    // Center lanes in a 60% width area
    const laneAreaWidth = canvas.width * 0.6;
    const laneOffsetX = (canvas.width - laneAreaWidth) / 2;
    const noteWidth = laneAreaWidth / noteLanes;
    const noteHeight = 40;
    const targetLineY = 20;
    let notes = [];
    // Partikel für Bubble-Pop
    let particles = [];
    let keys = {ArrowLeft:false,ArrowUp:false,ArrowDown:false,ArrowRight:false};
    const noteToKey = ['ArrowLeft','ArrowUp','ArrowDown','ArrowRight'];
    let score = 0, misses = 0, roundOver = false;
    let warmup = true;
    let warmupTime = 180; // ca. 5 Sekunden Warmup
    let roundTime = 30; // 30 Sekunden Spielzeit
    const fps = 30; // frames per second
    let frameCount = 0;
    let feedback = "";
    let feedbackTimer = 0;
    let lastFrameTime = 0;
    let feedbackColor = "#35ae40";
    let startTime = null;

    // === Neue, framerate-unabhängige Noten-Logik ===
    // Timing-basiertes Spawn-System
    const noteSpawnInterval = 1000; // Alle 1000ms = 1 Sekunde
    let lastNoteSpawnTime = performance.now();
    const noteSpeed = 180; // px pro Sekunde

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    function onKeyDown(e) { if(keys.hasOwnProperty(e.key)) keys[e.key]=true; }
    function onKeyUp(e)  { if(keys.hasOwnProperty(e.key)) keys[e.key]=false; }

    /**
     * Framerate-unabhängiges Noten-Update und -Spawning für das Piano-Spiel.
     * @param {number} deltaTime - Zeit seit letztem Frame in ms
     */
    function updateNotes(deltaTime) {
      const now = performance.now();
      if (!lastNoteSpawnTime) lastNoteSpawnTime = now;

      if (!warmup && now - lastNoteSpawnTime >= noteSpawnInterval) {
        const lastNote = notes[notes.length - 1];
        const newLane = Math.floor(Math.random() * noteLanes);
        if (!lastNote || lastNote.lane !== newLane || lastNote.y < canvas.height - 100) {
          notes.push({ lane: newLane, y: canvas.height });
          lastNoteSpawnTime = now;
        }
      }

      for (let i = notes.length - 1; i >= 0; i--) {
        const note = notes[i];
        note.y -= noteSpeed * (deltaTime / 1000); // move notes upward per second
        if (note.y + noteHeight < 0) {
          notes.splice(i, 1); // remove notes off-screen
        }
      }
    }

    /**
     * Hauptschleife für das Piano-Minispiel, framerate-unabhängig.
     * - Zuerst Warmup-Phase mit Hinweis.
     * - Dann: Noten fallen herab, Spieler muss sie passend zur Linie treffen.
     * - Fehlerlimit oder Zeitablauf beendet die Runde.
     * - Noten werden jetzt timing-basiert gespawnt (deltaTime, performance.now).
     */
    function gameTick(timestamp) {
      const now = performance.now();
      const deltaTime = lastFrameTime ? now - lastFrameTime : 16.67;
      lastFrameTime = now;

      lastTime = timestamp;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Partikel-Render und Zeichnen
      particles.forEach((p, idx) => {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.03;
        if (p.alpha > 0) {
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });
      // Entferne verbrauchte Partikel
      for (let i = particles.length - 1; i >= 0; i--) {
        if (particles[i].alpha <= 0) {
          particles.splice(i, 1);
        }
      }

      // Zeichnet Noten-Spuren und Ziel-Linie
      for (let i = 0; i < noteLanes; i++) {
        const key = noteToKey[i];
        ctx.globalAlpha = keys[key] ? 0.5 : 0.2;
        ctx.fillStyle = "#40e0d0";
        ctx.fillRect(laneOffsetX + i * noteWidth, 0, noteWidth - 2, canvas.height);
        ctx.globalAlpha = 1;
      }
      // Semi-transparent target line
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = "#abffe9";
      ctx.fillRect(laneOffsetX, targetLineY - 6, laneAreaWidth, noteHeight + 12);
      ctx.globalAlpha = 1;

      ctx.font = "bold 24px pixelify-sans";
      for (let i = 0; i < noteLanes; i++) {
        const key = noteToKey[i];
        ctx.fillStyle = keys[key] ? "#fff" : "#888";
        let symbol = "←";
        if (key == "ArrowUp") symbol = "↑";
        if (key == "ArrowDown") symbol = "↓";
        if (key == "ArrowRight") symbol = "→";
        ctx.fillText(symbol, laneOffsetX + i * noteWidth + noteWidth / 2, targetLineY + noteHeight + 55);
      }
      // --- WARMUP-PHASE: Zeigt Hinweis, lässt Spieler die Steuerung ausprobieren ---
      if (warmup) {
        ctx.textAlign = "center";
        const alpha = warmupTime > 60 ? 1 : warmupTime / 60;
        ctx.globalAlpha = alpha;
        ctx.font = "bold 32px pixelify-sans";
        ctx.fillStyle = "#fff";
        ctx.fillText("WARM UP!", canvas.width / 2, canvas.height / 2 - 40);
        ctx.font = "24px pixelify-sans";
        ctx.fillText("Beweg den Joystick in verschiedene Richtungen", canvas.width / 2, canvas.height / 2 + 10);
        ctx.globalAlpha = 1;
        warmupTime--;
        if (warmupTime <= 0) {
          warmup = false;
        }
        if (warmupTime === 1) {
          spawnNote();
          lastNoteSpawnTime = performance.now();
        }
      }
      // Zeitberechnung mit realem Timer
      if (!startTime) startTime = Date.now();
      let elapsedTime = (Date.now() - startTime) / 1000;
      let secondsLeft = Math.ceil(roundTime - elapsedTime);
      ctx.fillStyle = "#fff";
      ctx.font = "35px pixelify-sans";
      ctx.fillText(secondsLeft + "Sek", canvas.width - 140, 42);

      // --- Timing-basiertes Note-Spawning (ersetzt spawnDelay) ---
      // Vorher: if (secondsLeft > 7 && spawnDelay <= 0) { spawnNote(); spawnDelay = fps; }
      // Jetzt:
      // Neue Bedingung: Notes nur spawnen, wenn mehr als 5 Sekunden übrig sind
      if (!warmup && secondsLeft > 7 && secondsLeft > 5 && now - lastNoteSpawnTime >= noteSpawnInterval) {
        spawnNote();
        lastNoteSpawnTime = now;
      }

      // Noten bewegen und zeichnen (heraufsteigende Kreise mit Glow)
      updateNotes(deltaTime);
      notes.forEach(note => {
        ctx.save();
        ctx.shadowColor = "#ffffff";
        ctx.shadowBlur = 15;
        ctx.fillStyle = "#ffffff";
        const x = laneOffsetX + note.lane * noteWidth + noteWidth / 2;
        const y = note.y + noteHeight / 2;
        const radius = noteHeight * 0.65;
        // Falls note.image existiert und geladen ist, zeichne das Bild, sonst Platzhalter
        if (note.image && note.image.complete) {
          ctx.drawImage(note.image, x - note.width / 2, note.y, note.width, note.height);
        } else {
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });

      // Prüft, ob Noten getroffen oder verpasst wurden
      for (let i = notes.length - 1; i >= 0; i--) {
        let note = notes[i];
        if (note.y < targetLineY + noteHeight && note.y > targetLineY - 10) {
          let key = noteToKey[note.lane];
          if (keys[key]) {
            const popX = laneOffsetX + note.lane * noteWidth + noteWidth / 2;
            const popY = note.y + noteHeight / 2;
            spawnParticles(popX, popY);
            notes.splice(i, 1);
            score++;
            const hitSound = noteCollectSound.cloneNode();
            hitSound.play().catch(e => console.log("Note hit sound error:", e));
            feedback = "Good!";
            feedbackTimer = 32;
            feedbackColor = "#ffffff";
            continue;
          }
        }
        if (note.y < targetLineY - 16) {
          const popX = laneOffsetX + note.lane * noteWidth + noteWidth / 2;
          const popY = note.y + noteHeight / 2;
          spawnParticles(popX, popY);
          notes.splice(i, 1);
          misses++;
          const missSound = noteMissedSound.cloneNode();
          missSound.play().catch(e => console.log("Note miss sound error:", e));
          feedback = "Nicht getroffen!";
          feedbackTimer = 40;
          feedbackColor = "#e44";
        }
      }

      // Feedback (Good!/Nicht getroffen!) anzeigen
      if (feedback && feedbackTimer > 0) {
        ctx.font = "bold 32px pixelify-sans";
        ctx.fillStyle = feedbackColor;
        ctx.fillText(feedback, canvas.width / 2, 80);
        feedbackTimer--;
        if (feedbackTimer === 0) feedback = "";
      }

      ctx.font = "22px pixelify-sans";
      ctx.fillStyle = "#ffffff";
      ctx.fillText("Fehler: " + misses + " / 5", canvas.width / 9, canvas.height - 44);
      frameCount++;
      // --- SPIEL BEENDET: Zu viele Fehler ---
      if (misses >= 5) {
        roundOver = true;
        if (!isSecondMinigame) {
          miniGameResult1 = false;
          isSecondMinigame = true;
          fadeToMiniGame("Dein Schlaf wird schlechter...", startGame, '#45B7B7');
        } else {
          miniGameResult2 = false;
          isSecondMinigame = false;
          fadeToMiniGame("Dein Schlaf wird schlechter...", showEndScreenIfDone, '#45B7B7');
        }
        const gameOverSound = new Audio("GAMEOVER.mp3");
        gameOverSound.play().catch(e => console.log("GAMEOVER error", e));
        notes = [];
        fadeOutAudio(pianoLoop1);
        fadeOutAudio(pianoLoop2);
      }
      // --- SPIEL BEENDET: Zeit abgelaufen (Gewonnen) ---
      else if (secondsLeft <= 0) {
        roundOver = true;
        if (!isSecondMinigame) {
          miniGameResult1 = true;
          isSecondMinigame = true;
          fadeToMiniGame("Sehr gut... Deine Seele ist entspannter…", () => {
            // Nach dem Feedback-Fade: Zeige exklusiven Fade für den Übergang zur zweiten Wortwahl
            if (miniGameResult1 !== null && miniGameResult2 === null) {
              fadeToMiniGame("Wähle drei Worte, die dich leiten _<br><br>Vielleicht wird dein Traum ein anderer...", () => {
                startGame();
              });
            } else {
              startGame();
            }
          }, '#45B7B7');
        } else {
          miniGameResult2 = true;
          isSecondMinigame = false;
          fadeToMiniGame("Sehr gut... Deine Seele ist entspannter…", showEndScreenIfDone, '#45B7B7');
        }
        const gameWinSound = new Audio("GAMEWIN.mp3");
        gameWinSound.play().catch(e => console.log("GAMEWIN error", e));
        notes = [];
        fadeOutAudio(pianoLoop1);
        fadeOutAudio(pianoLoop2);
      }

      // Fortsetzen, solange nicht vorbei
      if (!roundOver) {
        requestAnimationFrame(gameTick);
      } else {
        setTimeout(() => {
          window.removeEventListener("keydown", onKeyDown);
          window.removeEventListener("keyup", onKeyUp);
        }, 10000);
      }
    }
    /**
     * Erzeugt eine neue Note in einer zufälligen Spur, startet sie am unteren Rand
     */
    function spawnNote() {
      let lane;
      let attempts = 0;
      do {
        lane = Math.floor(Math.random() * noteLanes);
        const lastNote = notes.filter(n => n.lane === lane).slice(-1)[0];
        if (!lastNote || lastNote.y < canvas.height - 150) break;
        attempts++;
      } while (attempts < 10);
      notes.push({ lane: lane, y: canvas.height });
    }
    /**
     * Erzeugt ein paar kleine Partikel an (x,y) für Pop-Effekt
     */
    function spawnParticles(x, y) {
      const count = 8;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 1.5;
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          alpha: 1,
          size: Math.random() * 3 + 2
        });
      }
    }
    resultDiv.style.display = "none";
    lastTime = performance.now();
    requestAnimationFrame(gameTick);
}

/**
 * Blendet die Anzeige für Timer und Treffer (Fehler) ein, indem die 'hidden'-Klasse entfernt wird.
 * Diese Funktion kann angepasst werden, falls die Anzeige-Elemente andere IDs oder Klassen haben.
 */
function showGameStats() {
  const timerElement = document.getElementById("timer");
  const scoreElement = document.getElementById("score");

  if (timerElement) timerElement.classList.remove("hidden");
  if (scoreElement) scoreElement.classList.remove("hidden");
}

function hideGameStats() {
  const timerElement = document.getElementById("timer");
  const scoreElement = document.getElementById("score");

  if (timerElement) timerElement.classList.add("hidden");
  if (scoreElement) scoreElement.classList.add("hidden");
}

/**
 * Zeigt den Endscreen mit Gesamtauswertung, sobald beide Minigames gespielt wurden.
 * Zeigt je nach Ergebnis einen anderen Text und einen "Nochmal spielen"-Button.
 */
function showEndScreenIfDone() {
  // Piano-Video zuverlässig beenden, sobald Endscreen angezeigt wird
  hidePianoBackgroundVideo();
  container.classList.remove('bg-main','bg-piano','bg-dodge');
  container.classList.add('bg-main');
  // Hintergrundvideo wieder anzeigen auf Endscreen
  showBackgroundVideo();
  // Endscreen anzeigen, wenn beide Minigame-Resultate gesetzt sind (egal ob true oder false)
  if (miniGameResult1 !== null && miniGameResult2 !== null) {
    instructionDiv.style.display = 'none';
    // Musik wechseln
    fadeOutAudio(wordMusic);
    endMusic.pause();
    endMusic.currentTime = 0;
    // Ergebnistext je nach Erfolg in beiden Minigames
    let message;
    if (miniGameResult1 === true && miniGameResult2 === true) {
      message = `<h2>Erholsamer Schlaf!</h2><p>Du hast 2 von 2 Träumen erfolgreich gemeistert</p>`;
    } else if (miniGameResult1 === false && miniGameResult2 === false) {
      // beide verloren
      message = `<h2>Was ein Albtraum!</h2><p>Du hast 0 von 2 Träumen erfolgreich gemeistert</p>`;
    } else {
      // eins verloren
      message = `<h2>Eine Unruhige Nacht…</h2><p>Du hast 1 von 2 Träumen erfolgreich gemeistert</p>`;
    }

    endscreenDiv.innerHTML = message + '<br><br><button id="restartButton" onclick="location.reload()" style="font-size:1em;padding:0.4em 1.2em">Nochmal spielen</button>';
    endscreenDiv.style.fontFamily = "'pixelify', sans-serif";
    endscreenDiv.style.color = "#fff";
    endscreenDiv.style.display = "block";
    // Stop all other background music before hiding canvas
    stopAllBackgroundMusic();
    // Play end music with fade (nach Endscreen-Anzeige)
    playSoundWithFade("ENDMUSIC", true);
    canvas.style.display = 'none';
    resultDiv.style.display = 'none';
  }
}

// Event Listener: Leertaste triggert "Nochmal spielen"-Button, wenn sichtbar
document.addEventListener("keydown", function (e) {
  if (e.code === "Space" && document.getElementById("restartButton")?.offsetParent !== null) {
    document.getElementById("restartButton").click();
  }
});

/**
 * Blendet ein Overlay für Übergänge zwischen Spielphasen/Minigames ein.
 * Zeigt Text, spielt Sound, ruft dann die nächste Funktion (Minigame/Phase) auf.
 * @param {string} text - Anzeigetext
 * @param {function} callback - Funktion, die nach dem Fade-in/fade-out aufgerufen wird
 * @param {string} color - Hintergrundfarbe
 */
function fadeToMiniGame(text, callback, color = 'black') {
  fadeToMiniGame_inner(text, callback, color);
}

// Hilfsfunktion, damit wir fadeToMiniGame rekursiv aufrufen können
function fadeToMiniGame_inner(text, callback, color = 'black') {
  const overlay = document.createElement('div');
  overlay.style.cssText = `position:fixed;top:0;left:0;right:0;bottom:0;background:${color};display:flex;align-items:center;justify-content:center;z-index:1000;opacity:0;transition:opacity 3s ease;`;
  overlay.innerHTML += `<div style="color:white;font-family:'pixelify-sans',sans-serif;font-size:3em;text-align:center;position:relative;z-index:2;opacity:1;transition:opacity 4s ease;">${text}</div>`;

  
  // --- Sound für Dodge-Minigame direkt zu Beginn abspielen ---
  if (callback === startDodgeMiniGame) {
    if (!dodgeStartSound) {
      dodgeStartSound = new Audio("DODGESTART.mp3");
    }
    dodgeStartSound.currentTime = 0;
    dodgeStartSound.play().catch(e => console.log("DODGESTART fade error", e));
  } else {
    gameStartSound.currentTime = 0;
    gameStartSound.play().catch(e => console.log("GAMESTART fade error:", e));
  }

  document.body.appendChild(overlay);

  setTimeout(() => {
    fadeOutAudio(wordMusic);
    overlay.style.opacity = '1';
    const textElement = overlay.querySelector("div");
    textElement.style.opacity = '1';
    if (callback === startGoodDreamMiniGame) {
      pianoLoop2.currentTime = 0;
      pianoLoop2.volume = 1;
      pianoLoop2.play().catch(e => console.log("Pre-fade PIANOGAME1 error", e));
    }
    setTimeout(() => {
      textElement.innerHTML = text;
      hidePianoBackgroundVideo();
    }, 500);
    setTimeout(() => {
      textElement.style.opacity = '0';
    }, 2000);
    setTimeout(() => {
      callback();
      if (callback === startGame) {
        fadeInAudio(wordMusic);
      }
      overlay.style.opacity = '0';
      setTimeout(() => {
        document.body.removeChild(overlay);
      }, 2500);
    }, 4000);
  }, 50);
}


/**
 * Blendet ein Audioobjekt langsam aus (Volume auf 0, dann Pause)
 * @param {Audio} audio
 */
function fadeOutAudio(audio) {
  const fadeStep = 0.05;
  const interval = setInterval(() => {
    if (audio.volume > fadeStep) {
      audio.volume -= fadeStep;
    } else {
      audio.volume = 0;
      audio.pause();
      clearInterval(interval);
    }
  }, 100);
}
/**
 * Blendet ein Audioobjekt langsam ein (Volume von 0 auf 1)
 * @param {Audio} audio
 */
function fadeInAudio(audio) {
  audio.volume = 0;
  audio.play().catch(e => console.log("Fade-in play error", e));
  const fadeStep = 0.05;
  const interval = setInterval(() => {
    if (audio.volume < 1) {
      audio.volume = Math.min(1, audio.volume + fadeStep);
    } else {
      clearInterval(interval);
    }
  }, 100);
}



/**
 * Spielt ein Soundobjekt sofort ab (ohne Delay). Kann mit beliebigem Audio-Objekt verwendet werden.
 * @param {Audio} audioObj
 */
function playSound(audioObj) {
  if (!audioObj) return;
  audioObj.currentTime = 0;
  audioObj.play().catch(e => console.log("playSound error:", e));
}
/**
 * Spielt ein Audioobjekt im Loop ab (setzt currentTime=0, Volume=1, loop=true, play())
 * @param {Audio} audio
 */
function playLoop(audio) {
  if (!audio) return;
  audio.currentTime = 0;
  audio.volume = 1;
  audio.loop = true;
  audio.play().catch(e => console.log("playLoop error:", e));
}
// === Helper functions for end music and stopping background music ===
/**
 * Spielt einen Sound mit Fade-In ab. Kann für Endmusik verwendet werden.
 * @param {string} soundName - Name der Musikdatei ohne .mp3 (z.B. "ENDMUSIC")
 * @param {boolean} loop - Ob die Musik geloopt werden soll
 */
function playSoundWithFade(soundName, loop = false) {
  let audio;
  if (soundName === "ENDMUSIC") {
    audio = endMusic;
  } else if (soundName === "STARTMUSIC") {
    audio = startMusic;
  } else if (soundName === "WORDMUSIC") {
    audio = wordMusic;
  } else {
    // Fallback: neues Audioobjekt
    audio = new Audio(soundName + ".mp3");
  }
  if (audio) {
    audio.loop = !!loop;
    fadeInAudio(audio);
  }
}

/**
 * Stoppt alle Hintergrundmusiken abrupt.
 */
function stopAllBackgroundMusic() {
  [startMusic, wordMusic, endMusic, pianoLoop1, pianoLoop2].forEach(a => {
    if (a) {
      a.pause();
      a.currentTime = 0;
    }
  });
}
// === Hintergrundvideo-Steuerung ===

            