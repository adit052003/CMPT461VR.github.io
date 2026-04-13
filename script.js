// ============================================================
// Neon Escape VR — Core Game Logic
// CMPT 461 Immersive Computing — Adit Chowdhary
// ============================================================

/* ============================================================
   PROCEDURAL AUDIO ENGINE (Web Audio API)
   No external audio files needed — all sounds synthesized live.
   ============================================================ */
const NeonAudio = {
  ctx: null,
  masterGain: null,
  musicGain: null,
  musicEnabled: true,
  musicLoopId: null,

  /** Lazy-init on first user gesture (required by browsers) */
  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.45;
    this.masterGain.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.25;
    this.musicGain.connect(this.masterGain);
  },

  ensureContext() {
    this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },

  /** Play a single synth note */
  playNote(freq, dur, type, vol, delay) {
    type = type || 'sine';
    vol = vol !== undefined ? vol : 0.25;
    delay = delay || 0;
    this.ensureContext();
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + dur + 0.01);
  },

  /* ---- Sound-Effect helpers ---- */
  playLaneChange() {
    this.playNote(880, 0.07, 'sine', 0.18);
    this.playNote(1100, 0.07, 'sine', 0.14, 0.035);
  },

  playHit() {
    this.ensureContext();
    const now = this.ctx.currentTime;
    // Descending buzz
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.35);
    g.gain.setValueAtTime(0.45, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.36);
    // Noise burst
    const len = this.ctx.sampleRate * 0.12 | 0;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const ns = this.ctx.createBufferSource();
    ns.buffer = buf;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.35, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    ns.connect(ng);
    ng.connect(this.masterGain);
    ns.start(now);
  },

  playShieldBlock() {
    this.playNote(1400, 0.12, 'triangle', 0.22);
    this.playNote(900, 0.12, 'triangle', 0.15, 0.04);
  },

  playPowerUp() {
    this.playNote(523, 0.1, 'sine', 0.22, 0);
    this.playNote(659, 0.1, 'sine', 0.22, 0.07);
    this.playNote(784, 0.1, 'sine', 0.22, 0.14);
    this.playNote(1047, 0.18, 'sine', 0.28, 0.21);
  },

  playGameOver() {
    this.playNote(300, 0.45, 'sawtooth', 0.28, 0);
    this.playNote(200, 0.55, 'sawtooth', 0.22, 0.35);
    this.playNote(80, 1.0, 'sawtooth', 0.18, 0.75);
  },

  playLevelComplete() {
    this.playNote(523, 0.14, 'square', 0.18, 0);
    this.playNote(659, 0.14, 'square', 0.18, 0.11);
    this.playNote(784, 0.14, 'square', 0.18, 0.22);
    this.playNote(1047, 0.28, 'square', 0.24, 0.33);
    this.playNote(1318, 0.35, 'square', 0.20, 0.47);
  },

  playWin() {
    var notes = [523, 659, 784, 1047, 784, 1047, 1318, 1568];
    for (var i = 0; i < notes.length; i++) {
      this.playNote(notes[i], 0.22, 'sine', 0.20, i * 0.09);
    }
  },

  /* ---- Background Music Loop ---- */
  startMusic() {
    if (!this.musicEnabled) return;
    this.ensureContext();
    this.stopMusic();
    var self = this;

    var bassSequence = [
      65.41, 65.41, 73.42, 73.42,
      82.41, 82.41, 73.42, 73.42
    ];
    var padChords = [
      [130.81, 164.81, 196.00],
      [146.83, 185.00, 220.00],
      [164.81, 207.65, 246.94],
      [146.83, 185.00, 220.00]
    ];
    var arpNotes = [523, 392, 659, 523, 784, 659, 523, 392];
    var loopDur = 4.0;

    function scheduleLoop() {
      if (!self.musicEnabled || !self.ctx) return;
      var now = self.ctx.currentTime;

      // Bass line (sawtooth through lowpass)
      for (var i = 0; i < bassSequence.length; i++) {
        var t0 = now + i * (loopDur / bassSequence.length);
        var t1 = t0 + (loopDur / bassSequence.length);
        var bOsc = self.ctx.createOscillator();
        var bGain = self.ctx.createGain();
        var bFilt = self.ctx.createBiquadFilter();
        bOsc.type = 'sawtooth';
        bOsc.frequency.value = bassSequence[i];
        bFilt.type = 'lowpass';
        bFilt.frequency.value = 280;
        bFilt.Q.value = 8;
        bGain.gain.setValueAtTime(0.001, t0);
        bGain.gain.linearRampToValueAtTime(0.14, t0 + 0.03);
        bGain.gain.setValueAtTime(0.14, t1 - 0.05);
        bGain.gain.exponentialRampToValueAtTime(0.001, t1);
        bOsc.connect(bFilt);
        bFilt.connect(bGain);
        bGain.connect(self.musicGain);
        bOsc.start(t0);
        bOsc.stop(t1 + 0.01);
      }

      // Pad chords (triangle, soft)
      for (var c = 0; c < padChords.length; c++) {
        var ct0 = now + c * (loopDur / padChords.length);
        var ct1 = ct0 + (loopDur / padChords.length);
        for (var n = 0; n < padChords[c].length; n++) {
          var pOsc = self.ctx.createOscillator();
          var pGain = self.ctx.createGain();
          pOsc.type = 'triangle';
          pOsc.frequency.value = padChords[c][n];
          pGain.gain.setValueAtTime(0.001, ct0);
          pGain.gain.linearRampToValueAtTime(0.045, ct0 + 0.15);
          pGain.gain.setValueAtTime(0.045, ct1 - 0.1);
          pGain.gain.exponentialRampToValueAtTime(0.001, ct1);
          pOsc.connect(pGain);
          pGain.connect(self.musicGain);
          pOsc.start(ct0);
          pOsc.stop(ct1 + 0.01);
        }
      }

      // Arpeggio (square, staccato)
      for (var a = 0; a < arpNotes.length; a++) {
        var at = now + a * (loopDur / arpNotes.length);
        var aOsc = self.ctx.createOscillator();
        var aGain = self.ctx.createGain();
        aOsc.type = 'square';
        aOsc.frequency.value = arpNotes[a];
        aGain.gain.setValueAtTime(0.001, at);
        aGain.gain.linearRampToValueAtTime(0.04, at + 0.01);
        aGain.gain.exponentialRampToValueAtTime(0.001, at + 0.18);
        aOsc.connect(aGain);
        aGain.connect(self.musicGain);
        aOsc.start(at);
        aOsc.stop(at + 0.2);
      }

      // Hi-hat (noise bursts on 8th notes)
      for (var h = 0; h < 8; h++) {
        var ht = now + h * (loopDur / 8);
        var hLen = self.ctx.sampleRate * 0.04 | 0;
        var hBuf = self.ctx.createBuffer(1, hLen, self.ctx.sampleRate);
        var hd = hBuf.getChannelData(0);
        for (var s = 0; s < hLen; s++) hd[s] = (Math.random() * 2 - 1) * (1 - s / hLen);
        var hSrc = self.ctx.createBufferSource();
        hSrc.buffer = hBuf;
        var hGain = self.ctx.createGain();
        var hFilt = self.ctx.createBiquadFilter();
        hFilt.type = 'highpass';
        hFilt.frequency.value = 8000;
        hGain.gain.setValueAtTime(0.06, ht);
        hGain.gain.exponentialRampToValueAtTime(0.001, ht + 0.04);
        hSrc.connect(hFilt);
        hFilt.connect(hGain);
        hGain.connect(self.musicGain);
        hSrc.start(ht);
      }

      // Kick drum on beats 1 and 5
      for (var k = 0; k < 2; k++) {
        var kt = now + k * (loopDur / 2);
        var kOsc = self.ctx.createOscillator();
        var kGain = self.ctx.createGain();
        kOsc.type = 'sine';
        kOsc.frequency.setValueAtTime(150, kt);
        kOsc.frequency.exponentialRampToValueAtTime(30, kt + 0.15);
        kGain.gain.setValueAtTime(0.35, kt);
        kGain.gain.exponentialRampToValueAtTime(0.001, kt + 0.2);
        kOsc.connect(kGain);
        kGain.connect(self.musicGain);
        kOsc.start(kt);
        kOsc.stop(kt + 0.22);
      }

      self.musicLoopId = setTimeout(scheduleLoop, (loopDur - 0.15) * 1000);
    }

    scheduleLoop();
  },

  stopMusic() {
    if (this.musicLoopId) {
      clearTimeout(this.musicLoopId);
      this.musicLoopId = null;
    }
  },

  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    if (this.musicEnabled) this.startMusic();
    else this.stopMusic();
    return this.musicEnabled;
  }
};


/* ============================================================
   PROCEDURAL TEXTURE GENERATOR (Canvas 2D → data URL)
   Creates textures at runtime — no image files needed.
   ============================================================ */
const NeonTextures = {
  /** Cyber-grid texture for tunnel walls */
  createGridTexture(w, h, lineColor, bgColor) {
    w = w || 512; h = h || 512;
    lineColor = lineColor || '#00ffcc';
    bgColor = bgColor || '#04041a';
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var x = c.getContext('2d');
    x.fillStyle = bgColor;
    x.fillRect(0, 0, w, h);
    x.strokeStyle = lineColor;
    x.lineWidth = 1;
    x.globalAlpha = 0.5;
    var cell = 32;
    for (var i = 0; i <= w; i += cell) {
      x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke();
    }
    for (var j = 0; j <= h; j += cell) {
      x.beginPath(); x.moveTo(0, j); x.lineTo(w, j); x.stroke();
    }
    // Glow dots at intersections
    x.globalAlpha = 0.7;
    for (var gx = 0; gx <= w; gx += cell) {
      for (var gy = 0; gy <= h; gy += cell) {
        var grad = x.createRadialGradient(gx, gy, 0, gx, gy, 5);
        grad.addColorStop(0, lineColor);
        grad.addColorStop(1, 'transparent');
        x.fillStyle = grad;
        x.fillRect(gx - 5, gy - 5, 10, 10);
      }
    }
    x.globalAlpha = 1;
    return c.toDataURL();
  },

  /** Hexagonal pattern for obstacles */
  createHexTexture(w, h, color) {
    w = w || 256; h = h || 256;
    color = color || '#aa00ff';
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var x = c.getContext('2d');
    x.fillStyle = '#08001a';
    x.fillRect(0, 0, w, h);
    var sz = 24;
    var hh = sz * Math.sqrt(3);
    x.strokeStyle = color;
    x.lineWidth = 1.5;
    x.globalAlpha = 0.5;
    for (var row = -1; row < h / hh + 1; row++) {
      for (var col = -1; col < w / (sz * 1.5) + 1; col++) {
        var cx = col * sz * 1.5;
        var cy = row * hh + (col % 2 ? hh / 2 : 0);
        x.beginPath();
        for (var k = 0; k < 6; k++) {
          var a = (Math.PI / 3) * k - Math.PI / 6;
          var px = cx + sz * Math.cos(a);
          var py = cy + sz * Math.sin(a);
          if (k === 0) x.moveTo(px, py);
          else x.lineTo(px, py);
        }
        x.closePath();
        x.stroke();
      }
    }
    x.globalAlpha = 1;
    return c.toDataURL();
  },

  /** Neon floor grid */
  createFloorTexture(w, h) {
    w = w || 512; h = h || 512;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var x = c.getContext('2d');
    x.fillStyle = '#030310';
    x.fillRect(0, 0, w, h);
    x.strokeStyle = '#aa00ff';
    x.lineWidth = 1;
    x.globalAlpha = 0.35;
    var cell = 32;
    for (var j = 0; j <= h; j += cell) {
      x.beginPath(); x.moveTo(0, j); x.lineTo(w, j); x.stroke();
    }
    for (var i = 0; i <= w; i += cell) {
      x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke();
    }
    x.globalAlpha = 0.6;
    for (var gx = 0; gx <= w; gx += cell) {
      for (var gy = 0; gy <= h; gy += cell) {
        var gr = x.createRadialGradient(gx, gy, 0, gx, gy, 3);
        gr.addColorStop(0, '#ff00ff');
        gr.addColorStop(1, 'transparent');
        x.fillStyle = gr;
        x.fillRect(gx - 3, gy - 3, 6, 6);
      }
    }
    x.globalAlpha = 1;
    return c.toDataURL();
  }
};


/* Wait until a primitive's THREE mesh exists (avoids texture apply races). */
function whenMeshReady(el, callback) {
  function ready() {
    var mesh = el.getObject3D('mesh');
    return !!(mesh && mesh.material);
  }
  function finish() {
    if (ready()) callback();
  }
  if (ready()) {
    callback();
    return;
  }
  var deadline = performance.now() + 10000;
  function rafTick() {
    if (ready()) {
      callback();
      return;
    }
    if (performance.now() > deadline) {
      console.warn('[NeonEscape] whenMeshReady timed out:', el.id || el.tagName);
      return;
    }
    requestAnimationFrame(rafTick);
  }
  el.addEventListener('object3dset', function onObj(ev) {
    if (ev.detail && ev.detail.type === 'mesh') {
      el.removeEventListener('object3dset', onObj);
      finish();
    }
  });
  requestAnimationFrame(rafTick);
}


/* ============================================================
   A-FRAME COMPONENT: scene-setup
   Runs once on scene load — generates textures, builds floor,
   creates starfield particles, and applies materials.
   ============================================================ */
AFRAME.registerComponent('scene-setup', {
  init: function () {
    var self = this;
    var scene = this.el;

    // Wait for scene to fully load
    scene.addEventListener('loaded', function () {
      self.applyTextures();
      self.createFloor();
      self.createStarfield();
      self.createObstacleTexture();
    });
  },

  createObstacleTexture: function () {
    var hexSrc = NeonTextures.createHexTexture(256, 256, '#aa00ff');
    var assets = document.querySelector('a-assets');
    if (assets) {
      var img = document.createElement('img');
      img.setAttribute('id', 'tex-obstacle');
      img.setAttribute('src', hexSrc);
      assets.appendChild(img);
    }
  },

  /** Register <img> in a-assets so A-Frame's material system loads the map reliably. */
  ensureTextureAsset: function (id, dataUrl) {
    var existing = document.getElementById(id);
    if (existing) {
      existing.src = dataUrl;
      return existing;
    }
    var assets = document.querySelector('a-assets');
    var img = document.createElement('img');
    img.id = id;
    img.src = dataUrl;
    if (assets) assets.appendChild(img);
    return img;
  },

  applyTextures: function () {
    var tunnelEl = document.querySelector('#tunnel');
    if (!tunnelEl) return;

    var gridSrc = NeonTextures.createGridTexture(512, 512, '#00ffcc', '#06061a');
    var tunnelImg = this.ensureTextureAsset('tex-tunnel', gridSrc);

    function bindTunnelMaterial() {
      whenMeshReady(tunnelEl, function () {
        tunnelEl.setAttribute('material', {
          shader: 'standard',
          src: gridSrc,
          repeat: '8 24',
          color: '#8ab0c8',
          emissive: '#1a0838',
          emissiveIntensity: 0.38,
          transparent: true,
          opacity: 0.92,
          side: 'double',
          roughness: 0.88,
          metalness: 0.05
        });
      });
    }

    if (tunnelImg.complete && tunnelImg.naturalWidth) bindTunnelMaterial();
    else tunnelImg.addEventListener('load', bindTunnelMaterial);
  },

  createFloor: function () {
    var sceneEl = this.el;
    var floor = document.createElement('a-plane');
    floor.setAttribute('id', 'game-floor');
    floor.setAttribute('width', '50');
    floor.setAttribute('height', '200');
    floor.setAttribute('rotation', '-90 0 0');
    floor.setAttribute('position', '0 -0.03 -70');

    var floorSrc = NeonTextures.createFloorTexture(512, 512);
    var floorImg = this.ensureTextureAsset('tex-floor', floorSrc);

    function mountAndBind() {
      if (!floor.parentNode) sceneEl.appendChild(floor);
      whenMeshReady(floor, function () {
        floor.setAttribute('material', {
          shader: 'standard',
          src: floorSrc,
          repeat: '12 48',
          color: '#8890b8',
          emissive: '#280055',
          emissiveIntensity: 0.28,
          transparent: true,
          opacity: 0.94,
          roughness: 0.9,
          metalness: 0.05
        });
      });
    }

    if (floorImg.complete && floorImg.naturalWidth) mountAndBind();
    else floorImg.addEventListener('load', mountAndBind);
  },

  createStarfield: function () {
    // Create small glowing particles that fly past the player
    var parent = document.createElement('a-entity');
    parent.setAttribute('id', 'starfield');
    parent.setAttribute('starfield-particles', '');
    this.el.appendChild(parent);
  }
});


/* ============================================================
   A-FRAME COMPONENT: starfield-particles
   Creates and animates small glowing dots flying past the
   player to give a sense of speed.
   ============================================================ */
AFRAME.registerComponent('starfield-particles', {
  init: function () {
    this.particles = [];
    this.spawnRadius = 8;
    this.spawnDepth = 80;
    this.particleCount = 120;

    for (var i = 0; i < this.particleCount; i++) {
      this.spawnParticle(true);
    }
  },

  spawnParticle: function (randomZ) {
    var el = document.createElement('a-sphere');
    var x = (Math.random() - 0.5) * this.spawnRadius * 2;
    var y = Math.random() * 5 + 0.5;
    var z = randomZ ?
      -(Math.random() * this.spawnDepth) :
      -(this.spawnDepth * 0.8 + Math.random() * this.spawnDepth * 0.2);

    var colors = ['#00ffcc', '#aa00ff', '#ff0055', '#ffea00', '#00aaff'];
    var color = colors[Math.floor(Math.random() * colors.length)];
    var size = 0.02 + Math.random() * 0.06;
    var speed = 8 + Math.random() * 16;

    el.setAttribute('radius', size);
    el.setAttribute('position', x + ' ' + y + ' ' + z);
    el.setAttribute('material', 'shader: flat; color: ' + color);
    this.el.appendChild(el);

    this.particles.push({
      el: el,
      speed: speed,
      baseX: x,
      baseY: y
    });
  },

  tick: function (time, dt) {
    var gameManager = document.querySelector('[neon-game-manager]');
    if (!gameManager) return;
    var gm = gameManager.components['neon-game-manager'];
    var isPlaying = gm && (gm.data.state === 'level1' || gm.data.state === 'level2');
    var speedMult = isPlaying ? (gm.data.state === 'level2' ? 2.5 : 1.5) : 0.4;

    for (var i = 0; i < this.particles.length; i++) {
      var p = this.particles[i];
      var pos = p.el.getAttribute('position');
      pos.z += p.speed * speedMult * dt / 1000;

      if (pos.z > 5) {
        pos.z = -(this.spawnDepth * 0.8 + Math.random() * this.spawnDepth * 0.2);
        pos.x = (Math.random() - 0.5) * this.spawnRadius * 2;
        pos.y = Math.random() * 5 + 0.5;
      }

      p.el.setAttribute('position', pos);
    }
  }
});


/* ============================================================
   A-FRAME COMPONENT: neon-game-manager
   Main game state machine — splash → menu → playing → levels →
   game-over/win.  Controls HUD, audio, screen transitions.
   ============================================================ */
AFRAME.registerComponent('neon-game-manager', {
  schema: {
    state:      { type: 'string',  default: 'splash' },
    score:      { type: 'number',  default: 0 },
    lives:      { type: 'number',  default: 3 },
    music:      { type: 'boolean', default: true },
    difficulty: { type: 'string',  default: 'easy' },
    hasShield:  { type: 'boolean', default: false },
    multiplier: { type: 'number',  default: 1 }
  },

  init: function () {
    // HTML HUD references
    this.htmlHUD     = document.querySelector('#htmlHUD');
    this.scoreText   = document.querySelector('#htmlScoreText');
    this.levelText   = document.querySelector('#htmlLevelText');
    this.powerupText = document.querySelector('#htmlPowerupText');

    // HTML overlay references
    this.overlaySplash     = document.querySelector('#overlaySplash');
    this.overlayMenu       = document.querySelector('#overlayMenu');
    this.overlayTransition = document.querySelector('#overlayTransition');
    this.overlayGameOver   = document.querySelector('#overlayGameOver');
    this.overlayWin        = document.querySelector('#overlayWin');

    // Hide all legacy A-Frame UI screens (HTML overlays replace them)
    var screens = ['#splashScreen', '#menuScreen', '#transitionScreen',
                   '#gameOverScreen', '#winScreen'];
    screens.forEach(function (sel) {
      var el = document.querySelector(sel);
      if (el) el.setAttribute('visible', 'false');
    });

    // DEFERRED spawner reference
    this._spawner = null;

    this.setupUIHandlers();
    this.updateHUD();
    this.showScreen('splash');
  },

  /** Lazily resolve the spawner reference (safe against init order) */
  getSpawner: function () {
    if (!this._spawner) {
      var spawnerEl = document.querySelector('#spawner');
      if (spawnerEl && spawnerEl.components && spawnerEl.components['obstacle-spawner']) {
        this._spawner = spawnerEl.components['obstacle-spawner'];
      }
    }
    return this._spawner;
  },

  /* ---- Wire up HTML overlay buttons ---- */
  setupUIHandlers: function () {
    var self = this;

    // Splash → Menu
    document.querySelector('#htmlBtnStart').addEventListener('click', function () {
      NeonAudio.ensureContext(); // unlock audio
      self.showScreen('menu');
    });

    // Music toggle
    var btnMusic = document.querySelector('#htmlBtnMusic');
    btnMusic.addEventListener('click', function () {
      var on = NeonAudio.toggleMusic();
      self.data.music = on;
      btnMusic.textContent = 'Music: ' + (on ? 'ON' : 'OFF');
    });

    // Difficulty toggle
    var btnDiff = document.querySelector('#htmlBtnDiff');
    btnDiff.addEventListener('click', function () {
      NeonAudio.playLaneChange();
      self.data.difficulty = (self.data.difficulty === 'easy') ? 'hard' : 'easy';
      btnDiff.textContent = 'Difficulty: ' + self.data.difficulty.toUpperCase();
    });

    // Play
    document.querySelector('#htmlBtnPlay').addEventListener('click', function () {
      self.startGame();
    });

    // Restart (game-over screen)
    document.querySelector('#htmlBtnRestart').addEventListener('click', function () {
      self.showScreen('menu');
    });

    // Play Again (win screen)
    document.querySelector('#htmlBtnPlayAgain').addEventListener('click', function () {
      self.showScreen('menu');
    });
  },

  /* ---- Screen transitions ---- */
  showScreen: function (screenName) {
    // Only update state for actual screen names, not 'playing'
    // (startGame/startLevel2 manage state directly)
    if (screenName !== 'playing') {
      this.data.state = screenName;
    }
    var spawner = this.getSpawner();

    // Hide every overlay first
    this.overlaySplash.style.display     = 'none';
    this.overlayMenu.style.display       = 'none';
    this.overlayTransition.style.display = 'none';
    this.overlayGameOver.style.display   = 'none';
    this.overlayWin.style.display        = 'none';
    if (this.htmlHUD) {
      this.htmlHUD.style.display = 'block';
      this.htmlHUD.classList.toggle('hud-muted', screenName !== 'playing');
    }

    if (screenName === 'splash') {
      this.overlaySplash.style.display = 'flex';
      if (spawner) spawner.stop();

    } else if (screenName === 'menu') {
      this.overlayMenu.style.display = 'flex';
      if (spawner) spawner.stop();
      NeonAudio.stopMusic();

    } else if (screenName === 'gameOver') {
      this.overlayGameOver.style.display = 'flex';
      document.querySelector('#htmlGameOverScore').textContent =
        'Final Score: ' + Math.floor(this.data.score);
      if (spawner) spawner.stop();
      this.clearObstacles();
      NeonAudio.stopMusic();
      NeonAudio.playGameOver();

    } else if (screenName === 'win') {
      this.overlayWin.style.display = 'flex';
      document.querySelector('#htmlWinScore').textContent =
        'Final Score: ' + Math.floor(this.data.score);
      if (spawner) spawner.stop();
      this.clearObstacles();
      NeonAudio.stopMusic();
      NeonAudio.playWin();

    } else if (screenName === 'transition') {
      this.overlayTransition.style.display = 'flex';
      if (spawner) spawner.stop();
      this.clearObstacles();
      NeonAudio.playLevelComplete();
      var self = this;
      setTimeout(function () { self.startLevel2(); }, 3000);
    } else if (screenName === 'playing') {
      if (this.htmlHUD) this.htmlHUD.style.display = 'block';
    }
  },

  /* ---- Game flow ---- */
  startGame: function () {
    this.data.score      = 0;
    this.data.lives      = 3;
    this.data.hasShield  = false;
    this.data.multiplier = 1;
    this.showScreen('playing'); // hide overlays first, show HUD
    this.data.state      = 'level1'; // set state AFTER showScreen
    if (this.levelText) this.levelText.textContent = 'Level 1';
    this.updateHUD();

    document.querySelector('#playerRig').setAttribute('position', '0 0 0');
    // Reset player lane
    var pc = document.querySelector('#playerRig').components['player-controls'];
    if (pc) pc.data.currentLane = 1;

    var spawner = this.getSpawner();
    console.log('[NeonEscape] startGame — spawner:', spawner, 'difficulty:', this.data.difficulty);
    if (spawner) {
      spawner.start(1, this.data.difficulty);
    } else {
      // Fallback: try again after a short delay (component init race)
      var self = this;
      setTimeout(function() {
        var s = self.getSpawner();
        console.log('[NeonEscape] Retry spawner:', s);
        if (s) s.start(1, self.data.difficulty);
      }, 200);
    }

    NeonAudio.startMusic();

    // Update tunnel color for level 1
    this.setTunnelColor('#110033', '#00ffcc');

    var self = this;
    this.levelTimer = setTimeout(function () {
      if (self.data.state === 'level1') {
        self.showScreen('transition');
      }
    }, 30000);
  },

  startLevel2: function () {
    this.showScreen('playing'); // hide overlays first, show HUD
    this.data.state = 'level2'; // set state AFTER showScreen
    if (this.levelText) this.levelText.textContent = 'Level 2';
    this.updateHUD();

    var spawner = this.getSpawner();
    if (spawner) spawner.start(2, this.data.difficulty);

    NeonAudio.startMusic();

    // Shift tunnel color for level 2 (red/danger)
    this.setTunnelColor('#1a0008', '#ff0055');

    var self = this;
    this.levelTimer = setTimeout(function () {
      if (self.data.state === 'level2') {
        self.showScreen('win');
      }
    }, 40000);
  },

  setTunnelColor: function (emissiveHex, lineColor) {
    var tunnel = document.querySelector('#tunnel');
    if (!tunnel) return;

    var src = NeonTextures.createGridTexture(512, 512, lineColor, '#04041a');
    var imgEl = document.getElementById('tex-tunnel');

    function applyMat() {
      tunnel.setAttribute('material', {
        shader: 'standard',
        src: imgEl ? '#tex-tunnel' : src,
        repeat: '8 24',
        color: '#a098b8',
        emissive: emissiveHex,
        emissiveIntensity: 0.42,
        transparent: true,
        opacity: 0.92,
        side: 'double',
        roughness: 0.88,
        metalness: 0.05
      });
    }

    function afterTexReady() {
      whenMeshReady(tunnel, applyMat);
    }

    if (imgEl) {
      imgEl.addEventListener('load', afterTexReady, { once: true });
      imgEl.src = src;
    } else {
      afterTexReady();
    }
  },

  /* ---- Damage & Power-ups ---- */
  takeDamage: function () {
    if (this.data.state !== 'level1' && this.data.state !== 'level2') return;

    if (this.data.hasShield) {
      this.data.hasShield = false;
      this.updateHUD();
      NeonAudio.playShieldBlock();
      var flash = document.querySelector('#damageFlash');
      flash.setAttribute('material', 'color', '#00ffff');
      flash.setAttribute('animation', 'property: material.opacity; from: 0.5; to: 0; dur: 400; easing: easeOutQuad');
      setTimeout(function () { flash.setAttribute('material', 'color', '#ff0000'); }, 400);
      return;
    }

    this.data.lives--;
    this.updateHUD();
    NeonAudio.playHit();

    // Damage flash
    var flash2 = document.querySelector('#damageFlash');
    flash2.setAttribute('material', 'color', '#ff0000');
    flash2.setAttribute('animation', 'property: material.opacity; from: 0.6; to: 0; dur: 500; easing: easeOutQuad');

    // Screen shake via CSS class on the body
    document.body.classList.add('screen-shake');
    setTimeout(function () { document.body.classList.remove('screen-shake'); }, 350);

    if (this.data.lives <= 0) {
      clearTimeout(this.levelTimer);
      if (this.powerUpTimeout) clearTimeout(this.powerUpTimeout);
      this.showScreen('gameOver');
    }
  },

  collectPowerUp: function (type) {
    NeonAudio.playPowerUp();
    if (type === 'shield') {
      this.data.hasShield = true;
      this.updateHUD();
    } else if (type === 'hyper') {
      this.data.multiplier = 2;
      this.updateHUD();
      if (this.powerUpTimeout) clearTimeout(this.powerUpTimeout);
      var self = this;
      this.powerUpTimeout = setTimeout(function () {
        self.data.multiplier = 1;
        self.updateHUD();
      }, 5000);
    }
  },

  /* ---- HUD ---- */
  updateHUD: function () {
    if (this.scoreText) {
      this.scoreText.textContent = 'Score: ' + Math.floor(this.data.score);
    }
    if (this.powerupText) {
      if (this.data.hasShield) {
        this.powerupText.textContent = 'SHIELD ACTIVE';
        this.powerupText.style.color = '#00ffff';
      } else if (this.data.multiplier > 1) {
        this.powerupText.textContent = '2X SCORE';
        this.powerupText.style.color = '#ffea00';
      } else {
        this.powerupText.textContent = '';
      }
    }

    // Update health bar (3 pip indicators)
    for (var i = 1; i <= 3; i++) {
      var pip = document.querySelector('#lifePip' + i);
      if (pip) {
        if (i <= this.data.lives) {
          pip.className = 'health-pip active';
        } else {
          pip.className = 'health-pip inactive';
        }
      }
    }
  },

  clearObstacles: function () {
    var parent = document.querySelector('#spawner');
    while (parent && parent.firstChild) {
      parent.removeChild(parent.firstChild);
    }
  },

  /* ---- Per-frame score tick ---- */
  tick: function (time, timeDelta) {
    if (this.data.state === 'level1' || this.data.state === 'level2') {
      var speed = (this.data.state === 'level1') ? 10 : 20;
      this.data.score += ((speed * timeDelta) / 1000) * this.data.multiplier;
      // Only update HUD text every ~100ms to avoid performance churn
      if (!this._lastHUD || time - this._lastHUD > 100) {
        this.updateHUD();
        this._lastHUD = time;
      }
    }
  }
});


/* ============================================================
   A-FRAME COMPONENT: player-controls
   Gaze-based lane switching (VR) + arrow-key support (desktop).
   ============================================================ */
AFRAME.registerComponent('player-controls', {
  schema: {
    lanes:       { type: 'array',  default: [-2, 0, 2] },
    currentLane: { type: 'number', default: 1 },
    cooldown:    { type: 'number', default: 0 }
  },

  init: function () {
    this.camera = document.querySelector('#camera');
    this.gazeCooldown = 0; // separate longer cooldown for gaze

    var self = this;
    window.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft')  self.switchLane(-1);
      if (e.key === 'ArrowRight') self.switchLane(1);
    });
  },

  switchLane: function (dir) {
    if (this.data.cooldown > 0) return;

    var newLane = this.data.currentLane + dir;
    if (newLane >= 0 && newLane < this.data.lanes.length) {
      this.data.currentLane = newLane;
      var targetX = this.data.lanes[newLane];
      this.el.setAttribute('animation__move',
        'property: position; to: ' + targetX + ' 0 0; dur: 200; easing: easeOutQuad');
      this.data.cooldown = 280;
      this.gazeCooldown = 600; // longer gaze debounce
      NeonAudio.playLaneChange();
    }
  },

  tick: function (time, timeDelta) {
    if (this.data.cooldown > 0) this.data.cooldown -= timeDelta;
    if (this.gazeCooldown > 0) { this.gazeCooldown -= timeDelta; return; }

    var rot = this.camera.getAttribute('rotation');
    if (!rot) return;

    // Head-rotation lane switching with higher threshold + debounce
    if (rot.y > 25 && this.data.currentLane > 0) {
      this.switchLane(-1);
    } else if (rot.y < -25 && this.data.currentLane < 2) {
      this.switchLane(1);
    }
  }
});


/* ============================================================
   A-FRAME COMPONENT: obstacle-spawner
   Manages spawn timing, difficulty scaling, and creates
   obstacle entities with procedurally-styled visuals.
   ============================================================ */
AFRAME.registerComponent('obstacle-spawner', {
  schema: {
    active:             { type: 'boolean', default: false },
    level:              { type: 'number',  default: 1 },
    difficulty:         { type: 'string',  default: 'easy' },
    spawnRate:          { type: 'number',  default: 2000 },
    timeSinceLastSpawn: { type: 'number',  default: 0 }
  },

  init: function () {
    this.lanes = [-2, 0, 2];
  },

  start: function (level, difficulty) {
    this.data.active     = true;
    this.data.level      = level;
    this.data.difficulty  = difficulty;
    this.data.spawnRate   = (level === 1)
      ? (difficulty === 'hard' ? 1500 : 2500)
      : (difficulty === 'hard' ? 800  : 1500);
    this.data.timeSinceLastSpawn = 0;
  },

  stop: function () {
    this.data.active = false;
  },

  tick: function (time, timeDelta) {
    if (!this.data.active) return;

    // Gradually speed up (cap at 400ms)
    if (this.data.spawnRate > 400) {
      this.data.spawnRate -= timeDelta * 0.04;
    }

    // Animate tunnel scroll speed
    var tunnel = document.querySelector('#tunnel');
    if (tunnel) {
      var ta = tunnel.components['tunnel-animator'];
      if (ta) {
        var curSpeed = parseFloat(ta.data.speed) || 2.0;
        var maxSpeed = (this.data.level === 1) ? 6 : 10;
        if (curSpeed < maxSpeed) {
          tunnel.setAttribute('tunnel-animator', 'speed', curSpeed + timeDelta * 0.0001);
        }
      }
    }

    this.data.timeSinceLastSpawn += timeDelta;
    if (this.data.timeSinceLastSpawn >= this.data.spawnRate) {
      this.spawn();
      this.data.timeSinceLastSpawn = 0;
    }
  },

  spawn: function () {
    var el = document.createElement('a-entity');

    // Weighted random type selection
    var weights = [
      { t: 'block',   w: 20 },
      { t: 'barrier', w: 15 },
      { t: 'laser',   w: 15 },
      { t: 'moving',  w: 12 },
      { t: 'grid',    w: 10 },
      { t: 'shield',  w: 4  },
      { t: 'hyper',   w: 4  }
    ];
    var totalW = 0;
    for (var k = 0; k < weights.length; k++) totalW += weights[k].w;
    var r = Math.random() * totalW;
    var type = 'block';
    for (var j = 0; j < weights.length; j++) {
      if (r < weights[j].w) { type = weights[j].t; break; }
      r -= weights[j].w;
    }

    var laneIdx = Math.floor(Math.random() * this.lanes.length);
    var xPos = this.lanes[laneIdx];
    el.setAttribute('position', xPos + ' 1 -55');

    var zSpeed = (this.data.level === 1) ? 20 : 35;

    /* ---- Build obstacle geometry with richer visuals ---- */

    if (type === 'moving') {
      var targetLane = (laneIdx === 0) ? 2 : (laneIdx === 2 ? 0 : (Math.random() < 0.5 ? 0 : 2));
      el.setAttribute('obstacle',
        'mainType: obstacle; speed: ' + zSpeed +
        '; isMoving: true; startX: ' + xPos +
        '; endX: ' + this.lanes[targetLane]);
      // Outer shell
      var mBox = document.createElement('a-box');
      mBox.setAttribute('color', '#ff5500');
      mBox.setAttribute('scale', '1.4 1.4 1.4');
      mBox.setAttribute('material', 'src: #tex-obstacle; emissive: #ff5500; emissiveIntensity: 0.7; wireframe: false');
      el.appendChild(mBox);
      // Inner wireframe core
      var mWire = document.createElement('a-box');
      mWire.setAttribute('color', '#ffaa00');
      mWire.setAttribute('scale', '1.6 1.6 1.6');
      mWire.setAttribute('material', 'emissive: #ffaa00; emissiveIntensity: 1; wireframe: true; opacity: 0.5; transparent: true');
      mWire.setAttribute('animation', 'property: rotation; to: 0 360 0; loop: true; dur: 3000; easing: linear');
      el.appendChild(mWire);

    } else if (type === 'grid') {
      el.setAttribute('position', '0 1 -55');
      el.setAttribute('obstacle',
        'mainType: obstacle; speed: ' + zSpeed +
        '; isGrid: true; gapLane: ' + laneIdx);
      for (var gi = 0; gi < this.lanes.length; gi++) {
        if (gi !== laneIdx) {
          var gBlock = document.createElement('a-box');
          gBlock.setAttribute('position', this.lanes[gi] + ' 0 0');
          gBlock.setAttribute('color', '#ff0000');
          gBlock.setAttribute('material', 'emissive: #ff0000; emissiveIntensity: 1; wireframe: true');
          gBlock.setAttribute('scale', '1.8 3 0.2');
          el.appendChild(gBlock);
          // Solid inner fill for visibility
          var gFill = document.createElement('a-box');
          gFill.setAttribute('position', this.lanes[gi] + ' 0 0');
          gFill.setAttribute('color', '#660000');
          gFill.setAttribute('material', 'emissive: #880000; emissiveIntensity: 0.4; transparent: true; opacity: 0.5');
          gFill.setAttribute('scale', '1.7 2.9 0.15');
          el.appendChild(gFill);
        }
      }

    } else if (type === 'shield' || type === 'hyper') {
      el.setAttribute('obstacle', 'mainType: powerup; subtype: ' + type + '; speed: ' + zSpeed);
      var puColor = (type === 'shield') ? '#00ffff' : '#ffea00';
      var puSphere = document.createElement('a-sphere');
      puSphere.setAttribute('radius', '0.45');
      puSphere.setAttribute('color', puColor);
      puSphere.setAttribute('material', 'color: ' + puColor + '; shader: flat');
      puSphere.setAttribute('animation__bob', 'property: position; dir: alternate; loop: true; to: 0 0.5 0; dur: 600; easing: easeInOutSine');
      puSphere.setAttribute('animation__spin', 'property: rotation; to: 0 360 0; loop: true; dur: 2000; easing: linear');
      el.appendChild(puSphere);
      // Outer glow ring
      var puRing = document.createElement('a-torus');
      puRing.setAttribute('radius', '0.7');
      puRing.setAttribute('radius-tubular', '0.04');
      puRing.setAttribute('color', puColor);
      puRing.setAttribute('material', 'color: ' + puColor + '; shader: flat; transparent: true; opacity: 0.6');
      puRing.setAttribute('animation', 'property: rotation; to: 360 360 0; loop: true; dur: 3000; easing: linear');
      el.appendChild(puRing);

    } else {
      el.setAttribute('obstacle', 'mainType: obstacle; speed: ' + zSpeed);

      if (type === 'block') {
        var bBox = document.createElement('a-box');
        bBox.setAttribute('color', '#ff0055');
        bBox.setAttribute('scale', '1.4 1.4 1.4');
        bBox.setAttribute('material', 'src: #tex-obstacle; emissive: #ff0055; emissiveIntensity: 0.6');
        el.appendChild(bBox);
        // Spinning wireframe wrapper
        var bWire = document.createElement('a-box');
        bWire.setAttribute('color', '#ff3388');
        bWire.setAttribute('scale', '1.7 1.7 1.7');
        bWire.setAttribute('material', 'emissive: #ff3388; emissiveIntensity: 0.8; wireframe: true; transparent: true; opacity: 0.4');
        bWire.setAttribute('animation', 'property: rotation; to: 45 360 45; loop: true; dur: 4000; easing: linear');
        el.appendChild(bWire);

      } else if (type === 'barrier') {
        var barr = document.createElement('a-box');
        barr.setAttribute('color', '#00ffcc');
        barr.setAttribute('scale', '1.8 0.6 0.6');
        barr.setAttribute('material', 'src: #tex-obstacle; emissive: #00ffcc; emissiveIntensity: 0.8');
        barr.setAttribute('animation__spin', 'property: rotation; to: 0 0 360; loop: true; dur: 1800; easing: linear');
        el.appendChild(barr);
        // Second cross-bar
        var barr2 = document.createElement('a-box');
        barr2.setAttribute('color', '#00cc99');
        barr2.setAttribute('scale', '0.6 1.8 0.6');
        barr2.setAttribute('material', 'src: #tex-obstacle; emissive: #00cc99; emissiveIntensity: 0.7');
        barr2.setAttribute('animation__spin', 'property: rotation; to: 0 0 -360; loop: true; dur: 1800; easing: linear');
        el.appendChild(barr2);

      } else if (type === 'laser') {
        var laser = document.createElement('a-cylinder');
        laser.setAttribute('color', '#aa00ff');
        laser.setAttribute('radius', '0.08');
        laser.setAttribute('height', '3.5');
        laser.setAttribute('rotation', '0 0 90');
        laser.setAttribute('material', 'src: #tex-obstacle; color: #aa00ff; shader: flat');
        el.appendChild(laser);
        // Glow halo
        var laserGlow = document.createElement('a-cylinder');
        laserGlow.setAttribute('color', '#cc44ff');
        laserGlow.setAttribute('radius', '0.18');
        laserGlow.setAttribute('height', '3.5');
        laserGlow.setAttribute('rotation', '0 0 90');
        laserGlow.setAttribute('material', 'color: #cc44ff; shader: flat; transparent: true; opacity: 0.25');
        laserGlow.setAttribute('animation', 'property: material.opacity; from: 0.15; to: 0.35; dir: alternate; loop: true; dur: 300');
        el.appendChild(laserGlow);
      }
    }

    this.el.appendChild(el);
  }
});


/* ============================================================
   A-FRAME COMPONENT: obstacle
   Moves an obstacle toward the player; detects collision via
   bounding-box approximation and notifies the game manager.
   ============================================================ */
AFRAME.registerComponent('obstacle', {
  schema: {
    speed:    { type: 'number',  default: 20 },
    mainType: { type: 'string',  default: 'obstacle' },
    subtype:  { type: 'string',  default: '' },
    active:   { type: 'boolean', default: true },
    isMoving: { type: 'boolean', default: false },
    startX:   { type: 'number',  default: 0 },
    endX:     { type: 'number',  default: 0 },
    isGrid:   { type: 'boolean', default: false },
    gapLane:  { type: 'number',  default: 1 }
  },

  init: function () {
    this.playerRig = document.querySelector('#playerRig');
    this.gameManager = null;
    // Defer game-manager lookup
    var gmEl = document.querySelector('[neon-game-manager]');
    if (gmEl && gmEl.components && gmEl.components['neon-game-manager']) {
      this.gameManager = gmEl.components['neon-game-manager'];
    }
  },

  tick: function (time, timeDelta) {
    if (!this.data.active) return;

    // Late-bind game manager if init missed it
    if (!this.gameManager) {
      var gmEl = document.querySelector('[neon-game-manager]');
      if (gmEl && gmEl.components) {
        this.gameManager = gmEl.components['neon-game-manager'];
      }
      if (!this.gameManager) return;
    }

    var pos = this.el.getAttribute('position');
    pos.z += (this.data.speed * timeDelta) / 1000;

    if (this.data.isMoving) {
      var progress = (pos.z + 55) / 55;
      if (progress > 1) progress = 1;
      if (progress < 0) progress = 0;
      pos.x = this.data.startX + (this.data.endX - this.data.startX) * progress;
    }

    this.el.setAttribute('position', pos);

    // Collision detection (Z proximity)
    if (pos.z > -1.5 && pos.z < 1.5) {
      var playerPos = this.playerRig.getAttribute('position');
      var hit = false;

      if (this.data.isGrid) {
        var lanes = [-2, 0, 2];
        var gapX = lanes[this.data.gapLane];
        if (Math.abs(gapX - playerPos.x) > 0.8) hit = true;
      } else {
        if (Math.abs(pos.x - playerPos.x) < 1.0) hit = true;
      }

      if (hit) {
        if (this.data.mainType === 'obstacle') {
          this.gameManager.takeDamage();
        } else if (this.data.mainType === 'powerup') {
          this.gameManager.collectPowerUp(this.data.subtype);
        }
        this.data.active = false;
        this.el.setAttribute('visible', 'false');
      }
    }

    // Cleanup once past the player
    if (pos.z > 8) {
      if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
    }
  }
});


/* ============================================================
   A-FRAME COMPONENT: tunnel-animator
   Scrolls the tunnel texture along the Y axis to create the
   illusion of forward motion.
   ============================================================ */
AFRAME.registerComponent('tunnel-animator', {
  schema: {
    speed: { type: 'number', default: 2.0 }
  },

  tick: function (time, timeDelta) {
    var mesh = this.el.getObject3D('mesh');
    if (mesh && mesh.material && mesh.material.map) {
      mesh.material.map.offset.y -= this.data.speed * timeDelta / 1000;
    }
  }
});
