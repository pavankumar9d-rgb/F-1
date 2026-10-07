import { EngineConfig, QualityTier, TelemetryState } from '../types/index';

export class HeroEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private heroSection: HTMLElement | null;

  // Telemetry HUD Elements
  private hudFrame: HTMLElement | null;
  private hudRecTime: HTMLElement | null;
  private hudSpeed: HTMLElement | null;
  private hudChapterText: HTMLElement | null;
  private hudProgressFill: HTMLElement | null;
  private chapterCards: NodeListOf<HTMLElement>;
  private scrollPrompt: HTMLElement | null;
  private debugOverlay: HTMLElement | null;

  // Config
  private config: EngineConfig = {
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

  private activeTier: QualityTier = '720';
  private target: number = 0;
  private current: number = 0;
  private lastDrawnCurrent: number = -1;
  private lastTime: number = performance.now();
  private scrollProgress: number = 0;

  // Caching
  private coarseCache: Map<number, ImageBitmap | HTMLImageElement> = new Map();
  private tierCache: Map<number, ImageBitmap | HTMLImageElement> = new Map();
  private inFlight: Map<string, AbortController> = new Map();
  private readonly maxConcurrentFetches: number = 8;

  // Diagnostics & Auto-Downgrade
  private drawTimes: number[] = [];
  private fpsHistory: number[] = [];
  private lastFpsUpdate: number = performance.now();
  private currentFps: number = 60;
  private consecutiveFailures: number = 0;
  private isDebug: boolean = false;

  private readonly windowMargins: Record<QualityTier, number> = {
    '2k': 8,
    '1080': 10,
    '720': 24
  };

  constructor(canvasId: string, heroId: string) {
    const canvasEl = document.getElementById(canvasId) as HTMLCanvasElement | null;
    if (!canvasEl) throw new Error(`Canvas #${canvasId} not found`);
    this.canvas = canvasEl;
    const context = this.canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('2D context not available');
    this.ctx = context;

    this.heroSection = document.getElementById(heroId);
    this.hudFrame = document.getElementById('hudFrame');
    this.hudRecTime = document.getElementById('hudRecTime');
    this.hudSpeed = document.getElementById('hudSpeed');
    this.hudChapterText = document.getElementById('hudChapterText');
    this.hudProgressFill = document.getElementById('hudProgressFill');
    this.chapterCards = document.querySelectorAll('.hero-chapter-card');
    this.scrollPrompt = document.querySelector('.hero-scroll-prompt');
    this.debugOverlay = document.getElementById('debugOverlay');

    const params = new URLSearchParams(window.location.search);
    this.isDebug = params.get('debug') === '1';
    if (this.isDebug && this.debugOverlay) {
      this.debugOverlay.style.display = 'block';
    }
  }

  public async start(): Promise<void> {
    await this.loadConfig();
    this.selectTier();
    this.resizeCanvas();

    const ro = new ResizeObserver(() => {
      this.resizeCanvas();
      this.draw();
    });
    ro.observe(this.canvas);

    this.updateScrollTarget();
    window.addEventListener('scroll', () => this.updateScrollTarget(), { passive: true });
    window.addEventListener('resize', () => this.updateScrollTarget(), { passive: true });
    window.addEventListener('orientationchange', () => this.updateScrollTarget(), { passive: true });

    await this.preloadInitialSet();
    requestAnimationFrame((t) => this.renderLoop(t));
  }

  private async loadConfig(): Promise<void> {
    try {
      let res = await fetch('frames-config.json');
      if (!res.ok) res = await fetch('assets/frames-config.json');
      if (res.ok) {
        this.config = await res.json();
      }
    } catch (e) {
      console.warn('Frames config fallback to defaults:', e);
    }
  }

  private selectTier(): void {
    const params = new URLSearchParams(window.location.search);
    const queryTier = params.get('tier') as QualityTier | null;
    if (queryTier && this.config.tiers[queryTier]) {
      this.activeTier = queryTier;
      console.log(`[HeroEngine] Forced tier via URL: ${this.activeTier}`);
      return;
    }

    const nav = navigator as Navigator & { deviceMemory?: number };
    const mem = nav.deviceMemory || 4;
    const cores = navigator.hardwareConcurrency || 4;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pxW = (window.innerWidth || 1280) * dpr;

    if (mem >= 8 && cores >= 8 && pxW > 1600) {
      this.activeTier = '2k';
    } else if (mem >= 4 && cores >= 4 && pxW > 1000) {
      this.activeTier = '1080';
    } else {
      this.activeTier = '720';
    }
    console.log(`[HeroEngine] Active tier: ${this.activeTier} (mem:${mem}GB, cores:${cores})`);
  }

  private getDprCap(): number {
    return this.activeTier === '720' ? 1.5 : 2;
  }

  public resizeCanvas(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, this.getDprCap());
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

  private getFrameUrl(index: number, tierName: QualityTier = this.activeTier): string {
    const tier = this.config.tiers[tierName] || this.config.tiers['720'];
    const pad = this.config.pad || 4;
    const ext = this.config.ext || 'webp';
    const num = String(index + 1).padStart(pad, '0');
    return `${tier.folder}/frame-${num}.${ext}`;
  }

  private async fetchAndDecode(index: number, tierName: QualityTier = this.activeTier): Promise<ImageBitmap | HTMLImageElement | null> {
    const url = this.getFrameUrl(index, tierName);
    const key = `${tierName}-${index}`;
    const controller = new AbortController();
    this.inFlight.set(key, controller);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();

      let decoded: ImageBitmap | HTMLImageElement;
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
      this.inFlight.delete(key);
      return decoded;
    } catch (err: unknown) {
      this.inFlight.delete(key);
      const isAbort = err instanceof Error && err.name === 'AbortError';
      if (!isAbort) {
        this.consecutiveFailures++;
        if (this.consecutiveFailures > 5) {
          this.checkAutoDowngrade(true);
        }
      }
      return null;
    }
  }

  private async preloadInitialSet(): Promise<void> {
    const fill = document.querySelector('.loader-bar-fill') as HTMLElement | null;
    const status = document.querySelector('.loader-status') as HTMLElement | null;
    const enterBtn = document.getElementById('enterBtn');

    // 1. Frame 1 first
    const frame1 = await this.fetchAndDecode(0, '720');
    if (frame1) {
      this.coarseCache.set(0, frame1);
      this.drawFrame(frame1, 1);
    }

    // 2. Coarse set: every 24th frame (1 frame per sec)
    const coarseList: number[] = [];
    for (let i = 0; i < this.config.count; i += 24) {
      if (i !== 0) coarseList.push(i);
    }
    if (coarseList[coarseList.length - 1] !== this.config.count - 1) {
      coarseList.push(this.config.count - 1);
    }

    let loaded = 1;
    const total = coarseList.length + 1;

    const chunkSize = 6;
    for (let i = 0; i < coarseList.length; i += chunkSize) {
      const slice = coarseList.slice(i, i + chunkSize);
      await Promise.all(slice.map(async idx => {
        const decoded = await this.fetchAndDecode(idx, '720');
        if (decoded) this.coarseCache.set(idx, decoded);
        loaded++;
        const pct = Math.min(100, Math.round((loaded / total) * 100));
        if (fill) fill.style.width = `${pct}%`;
        if (status) status.textContent = `SYNCHRONIZING TELEMETRY: ${pct}%`;
      }));
    }

    if (status) status.textContent = 'NOCTURNE SYSTEMS PRIMED — READY';
    if (enterBtn) enterBtn.classList.add('active');

    this.manageSlidingWindow();
  }

  public updateScrollTarget(): void {
    if (!this.heroSection) return;
    const rect = this.heroSection.getBoundingClientRect();
    const heroTop = window.scrollY + rect.top;
    const heroHeight = this.heroSection.offsetHeight;
    const scrollDist = heroHeight - window.innerHeight;

    if (scrollDist <= 0) {
      this.scrollProgress = 0;
    } else {
      this.scrollProgress = Math.max(0, Math.min(1, (window.scrollY - heroTop) / scrollDist));
    }

    this.target = this.scrollProgress * (this.config.count - 1);

    if (this.scrollPrompt && this.scrollProgress > 0.02) {
      this.scrollPrompt.classList.add('fade');
    }

    this.manageSlidingWindow();
  }

  private manageSlidingWindow(): void {
    const center = Math.round(this.target);
    const margin = this.windowMargins[this.activeTier];
    const start = Math.max(0, center - margin);
    const end = Math.min(this.config.count - 1, center + margin);

    // Cancel far out fetches
    for (const [key, controller] of this.inFlight.entries()) {
      const [, idxStr] = key.split('-');
      const idx = parseInt(idxStr, 10);
      if (idx < start - 15 || idx > end + 15) {
        controller.abort();
        this.inFlight.delete(key);
      }
    }

    // Evict frames outside window
    for (const idx of this.tierCache.keys()) {
      if (idx < start || idx > end) {
        const frame = this.tierCache.get(idx);
        if (frame && 'close' in frame && typeof frame.close === 'function') {
          frame.close();
        }
        this.tierCache.delete(idx);
      }
    }

    // Prioritized fetch order forward in scroll direction
    const needed: number[] = [center];
    const dir = this.target >= this.current ? 1 : -1;
    for (let d = 1; d <= margin; d++) {
      const fwd = center + d * dir;
      if (fwd >= 0 && fwd < this.config.count) needed.push(fwd);
      const bwd = center - d * dir;
      if (bwd >= 0 && bwd < this.config.count) needed.push(bwd);
    }

    let inProgress = 0;
    for (const idx of needed) {
      if (this.tierCache.has(idx) || this.inFlight.has(`${this.activeTier}-${idx}`)) continue;
      if (inProgress >= this.maxConcurrentFetches) break;
      inProgress++;
      this.fetchAndDecode(idx, this.activeTier).then(decoded => {
        if (decoded) this.tierCache.set(idx, decoded);
      });
    }
  }

  private getBestFrame(index: number): ImageBitmap | HTMLImageElement | null {
    if (this.tierCache.has(index)) return this.tierCache.get(index)!;

    let bestDist = Infinity;
    let bestFrame: ImageBitmap | HTMLImageElement | null = null;
    for (const [idx, frame] of this.tierCache.entries()) {
      const dist = Math.abs(idx - index);
      if (dist < bestDist) {
        bestDist = dist;
        bestFrame = frame;
      }
    }

    if (bestDist <= 3 && bestFrame) return bestFrame;

    let coarseDist = Infinity;
    let coarseFrame: ImageBitmap | HTMLImageElement | null = null;
    for (const [idx, frame] of this.coarseCache.entries()) {
      const dist = Math.abs(idx - index);
      if (dist < coarseDist) {
        coarseDist = dist;
        coarseFrame = frame;
      }
    }

    return bestFrame || coarseFrame || this.coarseCache.get(0) || null;
  }

  private drawFrame(frame: ImageBitmap | HTMLImageElement | null, alpha: number = 1): void {
    if (!frame) return;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const fw = frame.width;
    const fh = frame.height;
    if (!fw || !fh || !cw || !ch) return;

    const canvasRatio = cw / ch;
    const frameRatio = fw / fh;
    let sW: number, sH: number, sx: number, sy: number;

    const isPortrait = ch > cw;
    const focalX = isPortrait ? 0.52 : 0.5;

    if (canvasRatio > frameRatio) {
      sW = fw;
      sH = fw / canvasRatio;
      sx = 0;
      sy = (fh - sH) * 0.5;
    } else {
      sH = fh;
      sW = fh * canvasRatio;
      sx = Math.max(0, Math.min(fw - sW, (fw - sW) * focalX));
      sy = 0;
    }

    this.ctx.globalAlpha = alpha;
    this.ctx.drawImage(frame, sx, sy, sW, sH, 0, 0, cw, ch);
  }

  public draw(): void {
    const t0 = performance.now();

    const a = Math.floor(this.current);
    const b = Math.min(a + 1, this.config.count - 1);
    const alphaB = this.current - a;

    const frameA = this.getBestFrame(a);
    const frameB = alphaB > 0.001 ? this.getBestFrame(b) : null;

    if (frameA) this.drawFrame(frameA, 1.0);
    if (frameB && frameB !== frameA && alphaB > 0.001) {
      this.drawFrame(frameB, alphaB);
    }

    const duration = performance.now() - t0;
    this.drawTimes.push(duration);
    if (this.drawTimes.length > 90) {
      this.drawTimes.shift();
      this.checkAutoDowngrade();
    }

    this.lastDrawnCurrent = this.current;
  }

  public async ensureAndDraw(frameIndex: number): Promise<void> {
    const idx = Math.max(0, Math.min(this.config.count - 1, Math.round(frameIndex)));
    this.current = idx;
    this.target = idx;

    let frame: ImageBitmap | HTMLImageElement | null | undefined = this.tierCache.get(idx);
    if (!frame) {
      frame = await this.fetchAndDecode(idx, this.activeTier);
      if (frame) this.tierCache.set(idx, frame);
    }
    if (frame) {
      this.drawFrame(frame, 1.0);
    } else {
      this.draw();
    }
    this.updateHUD(idx);
  }

  private checkAutoDowngrade(force: boolean = false): void {
    if (this.activeTier === '720') return;
    const avg = this.drawTimes.reduce((acc, v) => acc + v, 0) / (this.drawTimes.length || 1);

    if (force || avg > 14) {
      const oldTier = this.activeTier;
      this.activeTier = this.activeTier === '2k' ? '1080' : '720';
      console.warn(`[HeroEngine] Downgrade triggered (${avg.toFixed(2)}ms): ${oldTier} -> ${this.activeTier}`);
      this.consecutiveFailures = 0;
      this.drawTimes = [];
      this.resizeCanvas();
      this.manageSlidingWindow();
    }
  }

  private updateHUD(easedFrame: number): void {
    const rounded = Math.round(easedFrame);
    const norm = this.config.count > 1 ? easedFrame / (this.config.count - 1) : 0;

    if (this.hudFrame) {
      const padded = String(rounded + 1).padStart(this.config.pad, '0');
      this.hudFrame.textContent = `FRAME ${padded} / ${this.config.count}`;
    }

    if (this.hudRecTime) {
      const secTotal = easedFrame / this.config.fps;
      const m = Math.floor(secTotal / 60);
      const s = Math.floor(secTotal % 60);
      const f = Math.floor((secTotal % 1) * this.config.fps);
      this.hudRecTime.textContent = `REC 00:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
    }

    if (this.hudSpeed) {
      let speed = 0;
      if (norm < 0.15) speed = Math.round((norm / 0.15) * 140);
      else if (norm < 0.40) speed = Math.round(140 + ((norm - 0.15) / 0.25) * 210);
      else if (norm < 0.56) speed = Math.round(350 - (norm - 0.40) * 90);
      else if (norm < 0.80) speed = Math.max(0, Math.round(310 * (1 - (norm - 0.56) / 0.24)));
      else speed = 0;
      this.hudSpeed.textContent = `CURRENT SPEED: ${speed} KM/H`;
    }

    if (this.hudProgressFill) {
      this.hudProgressFill.style.width = `${(norm * 100).toFixed(1)}%`;
    }

    // Chapters without water:
    // 0-0.20: 01 SKUNKWORKS ASSEMBLY
    // 0.20-0.40: 02 SUPERSONIC SPRINT
    // 0.40-0.56: 03 COCKPIT TELEMETRY
    // 0.56-0.80: 04 PROVING GROUND ARRIVAL
    // 0.80-1.00: 05 MIDNIGHT STARTING GRID
    let chIdx = 0;
    let chTitle = '01 SKUNKWORKS ASSEMBLY';

    if (norm < 0.20) {
      chIdx = 0;
      chTitle = '01 SKUNKWORKS ASSEMBLY';
    } else if (norm < 0.40) {
      chIdx = 1;
      chTitle = '02 SUPERSONIC SPRINT';
    } else if (norm < 0.56) {
      chIdx = 2;
      chTitle = '03 COCKPIT TELEMETRY';
    } else if (norm < 0.80) {
      chIdx = 3;
      chTitle = '04 PROVING GROUND ARRIVAL';
    } else {
      chIdx = 4;
      chTitle = '05 MIDNIGHT STARTING GRID';
    }

    if (this.hudChapterText) this.hudChapterText.textContent = chTitle;
    this.chapterCards.forEach((card, idx) => {
      card.classList.toggle('active', idx === chIdx);
    });

    if (this.isDebug && this.debugOverlay) {
      const avg = this.drawTimes.length ? (this.drawTimes.reduce((a, b) => a + b, 0) / this.drawTimes.length).toFixed(2) : '0';
      this.debugOverlay.innerHTML = `
        <strong>NOCTURNE APEX // TELEMETRY</strong><br>
        Tier: <span style="color:#C9A455">${this.activeTier}</span><br>
        FPS: ${this.currentFps} | Draw: ${avg}ms<br>
        Frame: ${rounded + 1} / ${this.config.count}<br>
        Current: ${this.current.toFixed(1)} | Target: ${this.target.toFixed(1)}<br>
        Tier Window: ${this.tierCache.size} | Coarse: ${this.coarseCache.size}<br>
        In-Flight Fetches: ${this.inFlight.size}
      `;
    }
  }

  private renderLoop(time: number): void {
    const rawDt = (time - this.lastTime) / 1000;
    this.lastTime = time;
    const dt = Math.min(rawDt, 0.05);

    this.fpsHistory.push(1 / (rawDt || 0.016));
    if (time - this.lastFpsUpdate > 500) {
      this.currentFps = Math.round(this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length);
      this.fpsHistory = [];
      this.lastFpsUpdate = time;
    }

    // Exponential frame-rate independent easing
    this.current += (this.target - this.current) * (1 - Math.exp(-dt * 9));
    if (Math.abs(this.target - this.current) < 0.001) {
      this.current = this.target;
    }

    if (Math.abs(this.current - this.lastDrawnCurrent) > 0.0005) {
      this.draw();
      this.updateHUD(this.current);
    }

    requestAnimationFrame((t) => this.renderLoop(t));
  }
}
