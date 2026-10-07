/**
 * OBSIDIAN GP — Hero Canvas Scrub Engine (24 fps, 1200 WebP Frames)
 * Features:
 * - Dynamic config loading from frames-config.json
 * - Native scroll mapping + persistent rAF render loop with exponential lerp
 * - Dual-frame crossfade (floor/ceil alpha blending) for buttery smoothness
 * - Tiered adaptive quality (2k, 1080, 720) with runtime auto-downgrade
 * - Pinned coarse set (every 24th frame from 720) + sliding window memory eviction
 * - AbortController for cancelable out-of-order fetches (max 8 concurrent)
 * - Telemetry HUD (live 4-digit frame counter, timecode, speed gauge, chapter drift)
 * - ?tier= and ?debug=1 URL parameter support
 */

class HeroEngine {
  constructor() {
    this.canvas = document.getElementById('heroCanvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.heroSection = document.getElementById('hero');

    // Telemetry HUD Elements
    this.hudFrame = document.getElementById('hudFrame');
    this.hudRecTime = document.getElementById('hudRecTime');
    this.hudSpeed = document.getElementById('hudSpeed');
    this.hudChapterText = document.getElementById('hudChapterText');
    this.hudProgressFill = document.getElementById('hudProgressFill');
    this.chapterCards = document.querySelectorAll('.hero-chapter-card');
    this.scrollPrompt = document.querySelector('.hero-scroll-prompt');
    this.debugOverlay = document.getElementById('debugOverlay');

    // Config defaults (updated via frames-config.json)
    this.config = {
      count: 1200,
      pad: 4,
      ext: 'webp',
      fps: 24,
      tiers: {
        '2k': { folder: 'frames-2k', w: 2048, h: 1152 },
        '1080': { folder: 'frames-1080', w: 1920, h: 1080 },
        '720': { folder: 'frames-720', w: 1280, h: 720 }
      }
    };

    // State
    this.activeTier = '720';
    this.target = 0;
    this.current = 0;
    this.lastDrawnCurrent = -1;
    this.lastTime = performance.now();
    this.scrollProgress = 0;

    // Cache & Memory management
    // Coarse set: map of index -> ImageBitmap / HTMLImageElement (from 720 tier, pinned)
    this.coarseCache = new Map();
    // Sliding window cache: map of index -> ImageBitmap / HTMLImageElement (from active tier)
    this.tierCache = new Map();
    // In-flight fetches: map of index -> AbortController
    this.inFlight = new Map();
    this.maxConcurrentFetches = 8;

    // Diagnostics / Auto-downgrade
    this.drawTimes = [];
    this.fpsHistory = [];
    this.lastFpsUpdate = performance.now();
    this.currentFps = 60;
    this.consecutiveFailures = 0;

    // Sliding window margins per tier
    this.windowMargins = {
      '2k': 8,
      '1080': 10,
      '720': 24
    };

    // Check debug flag
    this.urlParams = new URLSearchParams(window.location.search);
    this.isDebug = this.urlParams.get('debug') === '1';
    if (this.isDebug && this.debugOverlay) {
      this.debugOverlay.style.display = 'block';
    }

    this.init();
  }

  async init() {
    // 1. Fetch frames-config.json
    try {
      const res = await fetch('assets/frames-config.json');
      if (res.ok) {
        this.config = await res.json();
      }
    } catch (e) {
      console.warn('Using default frames config:', e);
    }

    // 2. Select initial quality tier
    this.selectTier();

    // 3. Size canvas
    this.resizeCanvas();
    const ro = new ResizeObserver(() => {
      this.resizeCanvas();
      this.draw();
    });
    ro.observe(this.canvas);

    // 4. Attach scroll and resize listeners
    this.updateScrollTarget();
    window.addEventListener('scroll', () => this.updateScrollTarget(), { passive: true });
    window.addEventListener('resize', () => this.updateScrollTarget(), { passive: true });
    window.addEventListener('orientationchange', () => this.updateScrollTarget(), { passive: true });

    // 5. Preload Frame 1 + Coarse Set
    await this.preloadInitialSet();

    // 6. Start continuous rAF render loop
    requestAnimationFrame((t) => this.renderLoop(t));
  }

  selectTier() {
    // Query override
    const queryTier = this.urlParams.get('tier');
    if (queryTier && this.config.tiers[queryTier]) {
      this.activeTier = queryTier;
      console.log(`[HeroEngine] Quality tier overridden by URL: ${this.activeTier}`);
      return;
    }

    const mem = navigator.deviceMemory || 4;
    const cores = navigator.hardwareConcurrency || 4;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = (window.innerWidth || 1280) * dpr;

    if (mem >= 8 && cores >= 8 && pixelWidth > 1600) {
      this.activeTier = '2k';
    } else if (mem >= 4 && cores >= 4 && pixelWidth > 1000) {
      this.activeTier = '1080';
    } else {
      this.activeTier = '720';
    }
    console.log(`[HeroEngine] Auto-selected tier: ${this.activeTier} (mem:${mem}GB, cores:${cores}, pxWidth:${Math.round(pixelWidth)})`);
  }

  getTierDprCap() {
    return this.activeTier === '720' ? 1.5 : 2;
  }

  resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, this.getTierDprCap());
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);

    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = 'high';
    }
  }

  getFrameUrl(index, tierName = this.activeTier) {
    const tier = this.config.tiers[tierName] || this.config.tiers['720'];
    const pad = this.config.pad || 4;
    const ext = this.config.ext || 'webp';
    const num = String(index + 1).padStart(pad, '0');
    return `assets/${tier.folder}/frame-${num}.${ext}`;
  }

  async fetchAndDecodeFrame(index, tierName = this.activeTier) {
    const url = this.getFrameUrl(index, tierName);
    const controller = new AbortController();
    this.inFlight.set(`${tierName}-${index}`, controller);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();

      let decoded;
      if (typeof createImageBitmap === 'function') {
        decoded = await createImageBitmap(blob);
      } else {
        decoded = await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = URL.createObjectURL(blob);
        });
      }
      this.inFlight.delete(`${tierName}-${index}`);
      return decoded;
    } catch (err) {
      this.inFlight.delete(`${tierName}-${index}`);
      if (err.name !== 'AbortError') {
        this.consecutiveFailures++;
        if (this.consecutiveFailures > 5) {
          this.checkAutoDowngrade(true);
        }
      }
      return null;
    }
  }

  async preloadInitialSet() {
    const loaderFill = document.querySelector('.loader-bar-fill');
    const loaderStatus = document.querySelector('.loader-status');
    const enterBtn = document.getElementById('enterBtn');

    // 1. Load Frame 0 (frame-0001) first and immediately render
    const firstFrame = await this.fetchAndDecodeFrame(0, '720');
    if (firstFrame) {
      this.coarseCache.set(0, firstFrame);
      this.drawFrame(firstFrame, 1);
    }

    // 2. Coarse set: every 24th frame (1 per sec)
    const coarseIndices = [];
    for (let i = 0; i < this.config.count; i += 24) {
      if (i !== 0) coarseIndices.push(i);
    }
    // Also include the last frame
    if (coarseIndices[coarseIndices.length - 1] !== this.config.count - 1) {
      coarseIndices.push(this.config.count - 1);
    }

    let loadedCount = 1;
    const totalToLoad = coarseIndices.length + 1;

    // Load coarse frames with limited concurrency
    const loadBatch = async (indices) => {
      for (const idx of indices) {
        try {
          const decoded = await this.fetchAndDecodeFrame(idx, '720');
          if (decoded) {
            this.coarseCache.set(idx, decoded);
          }
        } catch (e) {}
        loadedCount++;
        const pct = Math.min(100, Math.round((loadedCount / totalToLoad) * 100));
        if (loaderFill) loaderFill.style.width = `${pct}%`;
        if (loaderStatus) loaderStatus.textContent = `INITIALIZING TELEMETRY: ${pct}%`;
      }
    };

    // Chunk indices into small batches of 6
    const chunkSize = 6;
    for (let i = 0; i < coarseIndices.length; i += chunkSize) {
      const slice = coarseIndices.slice(i, i + chunkSize);
      await Promise.all(slice.map(idx => this.fetchAndDecodeFrame(idx, '720').then(res => {
        if (res) this.coarseCache.set(idx, res);
        loadedCount++;
        const pct = Math.min(100, Math.round((loadedCount / totalToLoad) * 100));
        if (loaderFill) loaderFill.style.width = `${pct}%`;
        if (loaderStatus) loaderStatus.textContent = `INITIALIZING TELEMETRY: ${pct}%`;
      })));
    }

    if (loaderStatus) loaderStatus.textContent = 'SYSTEMS OPERATIONAL — ACCESS READY';
    if (enterBtn) enterBtn.classList.add('active');

    // Trigger initial streaming for the starting window
    this.manageSlidingWindow();
  }

  updateScrollTarget() {
    if (!this.heroSection) return;
    const rect = this.heroSection.getBoundingClientRect();
    const heroTop = window.scrollY + rect.top;
    const heroHeight = this.heroSection.offsetHeight;
    const windowH = window.innerHeight;
    const scrollDistance = heroHeight - windowH;

    if (scrollDistance <= 0) {
      this.scrollProgress = 0;
    } else {
      const rawProgress = (window.scrollY - heroTop) / scrollDistance;
      this.scrollProgress = Math.max(0, Math.min(1, rawProgress));
    }

    this.target = this.scrollProgress * (this.config.count - 1);

    // Fade scroll hint once user starts scrolling
    if (this.scrollPrompt && this.scrollProgress > 0.02) {
      this.scrollPrompt.classList.add('fade');
    }

    // Prioritize streaming around new target
    this.manageSlidingWindow();
  }

  manageSlidingWindow() {
    const center = Math.round(this.target);
    const margin = this.windowMargins[this.activeTier] || 12;
    const start = Math.max(0, center - margin);
    const end = Math.min(this.config.count - 1, center + margin);

    // Cancel in-flight fetches that are far outside the window
    for (const [key, controller] of this.inFlight.entries()) {
      const [, idxStr] = key.split('-');
      const idx = parseInt(idxStr, 10);
      if (idx < start - 15 || idx > end + 15) {
        controller.abort();
        this.inFlight.delete(key);
      }
    }

    // Evict frames outside window from active tier
    for (const idx of this.tierCache.keys()) {
      if (idx < start || idx > end) {
        const item = this.tierCache.get(idx);
        if (item && typeof item.close === 'function') {
          item.close();
        }
        this.tierCache.delete(idx);
      }
    }

    // Determine frames to fetch, forward-biased in scroll direction
    const needed = [];
    const scrollDir = this.target >= this.current ? 1 : -1;

    // Center first, then forward steps, then backward steps
    needed.push(center);
    for (let d = 1; d <= margin; d++) {
      const forward = center + d * scrollDir;
      if (forward >= 0 && forward < this.config.count) needed.push(forward);
      const backward = center - d * scrollDir;
      if (backward >= 0 && backward < this.config.count) needed.push(backward);
    }

    // Schedule up to maxConcurrentFetches
    let inProgress = 0;
    for (const idx of needed) {
      if (this.tierCache.has(idx) || this.inFlight.has(`${this.activeTier}-${idx}`)) {
        continue;
      }
      if (inProgress >= this.maxConcurrentFetches) break;

      inProgress++;
      this.fetchAndDecodeFrame(idx, this.activeTier).then(decoded => {
        if (decoded) {
          this.tierCache.set(idx, decoded);
        }
      });
    }
  }

  getBestFrame(index) {
    // 1. Exact match in full tier cache
    if (this.tierCache.has(index)) {
      return this.tierCache.get(index);
    }

    // 2. Nearest in full tier cache
    let bestDist = Infinity;
    let bestFrame = null;
    for (const [idx, frame] of this.tierCache.entries()) {
      const dist = Math.abs(idx - index);
      if (dist < bestDist) {
        bestDist = dist;
        bestFrame = frame;
      }
    }

    // If within 3 frames, use tier cache neighbor
    if (bestDist <= 3 && bestFrame) {
      return bestFrame;
    }

    // 3. Fallback to nearest in pinned coarse cache
    let coarseDist = Infinity;
    let coarseFrame = null;
    for (const [idx, frame] of this.coarseCache.entries()) {
      const dist = Math.abs(idx - index);
      if (dist < coarseDist) {
        coarseDist = dist;
        coarseFrame = frame;
      }
    }

    return bestFrame || coarseFrame || this.coarseCache.get(0);
  }

  drawFrame(frame, alpha = 1) {
    if (!frame) return;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const fw = frame.width || frame.naturalWidth;
    const fh = frame.height || frame.naturalHeight;

    if (!fw || !fh || !cw || !ch) return;

    // Cover fit
    const canvasRatio = cw / ch;
    const frameRatio = fw / fh;
    let drawW, drawH, sx, sy, sW, sH;

    // Portrait focal adjustment: shift horizontally to keep car centered
    const isPortrait = ch > cw;
    const focalX = isPortrait ? 0.52 : 0.5;

    if (canvasRatio > frameRatio) {
      // Canvas is wider than frame: crop top/bottom
      sW = fw;
      sH = fw / canvasRatio;
      sx = 0;
      sy = (fh - sH) * 0.5;
    } else {
      // Canvas is taller than frame: crop left/right
      sH = fh;
      sW = fh * canvasRatio;
      sx = Math.max(0, Math.min(fw - sW, (fw - sW) * focalX));
      sy = 0;
    }

    this.ctx.globalAlpha = alpha;
    this.ctx.drawImage(frame, sx, sy, sW, sH, 0, 0, cw, ch);
  }

  draw() {
    const t0 = performance.now();

    const a = Math.floor(this.current);
    const b = Math.min(a + 1, this.config.count - 1);
    const alphaB = this.current - a;

    const frameA = this.getBestFrame(a);
    const frameB = alphaB > 0.001 ? this.getBestFrame(b) : null;

    if (frameA) {
      this.drawFrame(frameA, 1.0);
    }
    if (frameB && frameB !== frameA && alphaB > 0.001) {
      this.drawFrame(frameB, alphaB);
    }

    const drawDuration = performance.now() - t0;
    this.drawTimes.push(drawDuration);
    if (this.drawTimes.length > 90) {
      this.drawTimes.shift();
      this.checkAutoDowngrade();
    }

    this.lastDrawnCurrent = this.current;
  }

  checkAutoDowngrade(force = false) {
    if (this.activeTier === '720') return;

    const avgDraw = this.drawTimes.reduce((acc, v) => acc + v, 0) / (this.drawTimes.length || 1);
    if (force || avgDraw > 14) {
      const oldTier = this.activeTier;
      if (this.activeTier === '2k') {
        this.activeTier = '1080';
      } else if (this.activeTier === '1080') {
        this.activeTier = '720';
      }
      console.warn(`[HeroEngine] Performance threshold exceeded (${avgDraw.toFixed(2)}ms). Downgrading: ${oldTier} -> ${this.activeTier}`);
      this.consecutiveFailures = 0;
      this.drawTimes = [];
      this.resizeCanvas();
      this.manageSlidingWindow();
    }
  }

  updateHUD(easedFrame) {
    const rounded = Math.round(easedFrame);
    const normalizedProgress = this.config.count > 1 ? easedFrame / (this.config.count - 1) : 0;

    // 1. Frame indicator: "FRAME 0001 / 1200"
    if (this.hudFrame) {
      const paddedCurrent = String(rounded + 1).padStart(this.config.pad, '0');
      this.hudFrame.textContent = `FRAME ${paddedCurrent} / ${this.config.count}`;
    }

    // 2. Timecode: currentFrame / fps (00:00:SS:FF)
    if (this.hudRecTime) {
      const totalSeconds = easedFrame / (this.config.fps || 24);
      const mins = Math.floor(totalSeconds / 60);
      const secs = Math.floor(totalSeconds % 60);
      const frames = Math.floor((totalSeconds % 1) * (this.config.fps || 24));
      const tc = `REC 00:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
      this.hudRecTime.textContent = tc;
    }

    // 3. Telemetry Speed: ramps to ~340 km/h in chapters 2-3 (progress 0.20 to 0.56) and returns to 0 on arrival
    if (this.hudSpeed) {
      let speed = 0;
      if (normalizedProgress < 0.15) {
        speed = Math.round((normalizedProgress / 0.15) * 120);
      } else if (normalizedProgress < 0.40) {
        const t = (normalizedProgress - 0.15) / 0.25;
        speed = Math.round(120 + t * 220); // up to 340
      } else if (normalizedProgress < 0.56) {
        speed = Math.round(340 - (normalizedProgress - 0.40) * 80);
      } else if (normalizedProgress < 0.80) {
        const t = (normalizedProgress - 0.56) / 0.24;
        speed = Math.max(0, Math.round(300 * (1 - t)));
      } else {
        speed = 0;
      }
      this.hudSpeed.textContent = `CURRENT SPEED: ${speed} KM/H`;
    }

    // 4. Progress bar fill
    if (this.hudProgressFill) {
      this.hudProgressFill.style.width = `${(normalizedProgress * 100).toFixed(1)}%`;
    }

    // 5. Chapters:
    // 0-0.20 "01 THE BUILD"
    // 0.20-0.40 "02 THE COAST"
    // 0.40-0.56 "03 THE COCKPIT"
    // 0.56-0.80 "04 THE ARRIVAL"
    // 0.80-1.00 "05 THE GRID"
    let currentChapter = 0;
    let chapterName = '01 THE BUILD';

    if (normalizedProgress < 0.20) {
      currentChapter = 0;
      chapterName = '01 THE BUILD';
    } else if (normalizedProgress < 0.40) {
      currentChapter = 1;
      chapterName = '02 THE COAST';
    } else if (normalizedProgress < 0.56) {
      currentChapter = 2;
      chapterName = '03 THE COCKPIT';
    } else if (normalizedProgress < 0.80) {
      currentChapter = 3;
      chapterName = '04 THE ARRIVAL';
    } else {
      currentChapter = 4;
      chapterName = '05 THE GRID';
    }

    if (this.hudChapterText) {
      this.hudChapterText.textContent = chapterName;
    }

    // Chapter Card Activations
    this.chapterCards.forEach((card, idx) => {
      if (idx === currentChapter) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });

    // Debug Overlay Stats
    if (this.isDebug && this.debugOverlay) {
      const avgDraw = this.drawTimes.length ? (this.drawTimes.reduce((a, b) => a + b, 0) / this.drawTimes.length).toFixed(2) : '0';
      this.debugOverlay.innerHTML = `
        <strong>OBSIDIAN GP // ENGINE DEBUG</strong><br>
        Tier: <span style="color:var(--gold)">${this.activeTier}</span><br>
        FPS: ${this.currentFps} | Draw: ${avgDraw}ms<br>
        Current Frame: ${rounded + 1} / ${this.config.count}<br>
        Eased Target: ${this.current.toFixed(2)} / ${this.target.toFixed(2)}<br>
        Decoded Tier Cache: ${this.tierCache.size} frames<br>
        Pinned Coarse Cache: ${this.coarseCache.size} frames<br>
        Sliding Window Margin: ±${this.windowMargins[this.activeTier]}<br>
        In-flight Fetches: ${this.inFlight.size}
      `;
    }
  }

  renderLoop(time) {
    const rawDt = (time - this.lastTime) / 1000;
    this.lastTime = time;
    const dt = Math.min(rawDt, 0.05);

    // Track FPS
    this.fpsHistory.push(1 / (rawDt || 0.016));
    if (time - this.lastFpsUpdate > 500) {
      this.currentFps = Math.round(this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length);
      this.fpsHistory = [];
      this.lastFpsUpdate = time;
    }

    // Exponential frame-rate independent easing (k = 9)
    this.current += (this.target - this.current) * (1 - Math.exp(-dt * 9));

    // Snap on close proximity
    if (Math.abs(this.target - this.current) < 0.001) {
      this.current = this.target;
    }

    // Redraw when position changed by > 0.0005
    if (Math.abs(this.current - this.lastDrawnCurrent) > 0.0005) {
      this.draw();
      this.updateHUD(this.current);
    }

    // Persistent rAF loop - never stops
    requestAnimationFrame((t) => this.renderLoop(t));
  }
}

// Global initialization
window.addEventListener('DOMContentLoaded', () => {
  window.heroEngine = new HeroEngine();
});
