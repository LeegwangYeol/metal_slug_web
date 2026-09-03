/**
 * SoundEngine.ts - Procedural Web Audio API Sound Effects Engine for Metal Slug Web.
 *
 * Implements genuine real-time procedural audio synthesis using native Web Audio:
 * - Oscillators (sine, square, triangle, sawtooth)
 * - Cached multi-profile noise buffers (white, pink, brown)
 * - Dynamic biquad filters (lowpass, highpass, bandpass) with frequency sweeps
 * - Exponential gain envelopes and wave shaper non-linear distortion
 * - Graceful AudioContext lifecycle with auto-resume on first user gesture
 * - Integrated Formant Speech Synthesizer for arcade announcer clips
 */

import {
  AudioConfig,
  ISoundEngine,
  ISpeechSynthesizer,
  SoundEffectType,
  VoiceClipType,
} from './AudioTypes';
import { SpeechSynthesizer } from './SpeechSynthesizer';

export * from './AudioTypes';
export { SpeechSynthesizer };

export class SoundEngine implements ISoundEngine {
  public ctx: AudioContext | null = null;
  public masterGain: GainNode | null = null;
  public sfxGain: GainNode | null = null;
  public voiceGain: GainNode | null = null;

  public speech: ISpeechSynthesizer;

  private whiteNoiseBuffer: AudioBuffer | null = null;
  private pinkNoiseBuffer: AudioBuffer | null = null;
  private brownNoiseBuffer: AudioBuffer | null = null;
  private distortionCurve: Float32Array<ArrayBuffer> | null = null;

  private isMutedState = false;
  private masterVolume = 0.8;
  private sfxVolume = 0.9;
  private voiceVolume = 1.0;

  private interactionHandlers: Array<{ target: EventTarget; type: string; handler: () => void }> = [];
  private activeVoiceCount = 0;
  private readonly maxActiveVoices = 32;

  constructor(config?: AudioConfig) {
    if (config?.masterVolume !== undefined) this.masterVolume = config.masterVolume;
    if (config?.sfxVolume !== undefined) this.sfxVolume = config.sfxVolume;
    if (config?.voiceVolume !== undefined) this.voiceVolume = config.voiceVolume;
    if (config?.muted !== undefined) this.isMutedState = config.muted;

    this.initAudioContext();

    // Initialize speech synthesizer with voice output node
    this.speech = new SpeechSynthesizer(this.ctx, this.voiceGain);

    // Auto-resume on first user gesture
    this.setupAutoResume();
  }

  public get isReady(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /**
   * Initializes native Web Audio graph safely across browser environments.
   */
  private initAudioContext(): void {
    if (typeof window === 'undefined') return;

    try {
      const AudioCtxClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (!AudioCtxClass) {
        console.warn('[SoundEngine] Web Audio API is not supported in this environment.');
        return;
      }

      this.ctx = new AudioCtxClass();

      // Expose to window for testing / verification inspection (Playwright E2E spec compliance)
      (window as unknown as { __AUDIO_CTX__: AudioContext }).__AUDIO_CTX__ = this.ctx;

      // Master audio graph
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMutedState ? 0 : this.masterVolume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      this.voiceGain = this.ctx.createGain();
      this.voiceGain.gain.setValueAtTime(this.voiceVolume, this.ctx.currentTime);
      this.voiceGain.connect(this.masterGain);

      // Procedural audio assets
      this.generateNoiseBuffers();
      this.distortionCurve = this.createDistortionCurve(3.2);
    } catch (err) {
      console.warn('[SoundEngine] Failed to initialize AudioContext:', err);
    }
  }

  /**
   * Creates 2-second looped noise buffers: white, pink (Paul Kellet filter), brownian.
   */
  private generateNoiseBuffers(): void {
    if (!this.ctx) return;

    const sampleRate = this.ctx.sampleRate || 44100;
    const length = sampleRate * 2;

    // 1. White Noise Buffer
    this.whiteNoiseBuffer = this.ctx.createBuffer(1, length, sampleRate);
    const whiteData = this.whiteNoiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      whiteData[i] = Math.random() * 2 - 1;
    }

    // 2. Pink Noise Buffer (Paul Kellet's algorithm)
    this.pinkNoiseBuffer = this.ctx.createBuffer(1, length, sampleRate);
    const pinkData = this.pinkNoiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      pinkData[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }

    // 3. Brown Noise Buffer (Integrated leaky filter)
    this.brownNoiseBuffer = this.ctx.createBuffer(1, length, sampleRate);
    const brownData = this.brownNoiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      brownData[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = brownData[i];
      brownData[i] *= 3.5; // Gain compensation
    }
  }

  /**
   * Generates a hyperbolic tangent distortion transfer curve for arcade warmth.
   */
  private createDistortionCurve(k: number = 3.0): Float32Array<ArrayBuffer> {
    const n = 512;
    const buffer = new ArrayBuffer(n * 4);
    const curve = new Float32Array(buffer);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = Math.tanh(k * x);
    }
    return curve;
  }

  /**
   * Listens for first user gesture to unlock AudioContext.
   */
  private setupAutoResume(): void {
    if (typeof window === 'undefined') return;

    const resumeHandler = (): void => {
      this.resume().then(() => {
        if (this.ctx && this.ctx.state === 'running') {
          this.cleanupAutoResume();
        }
      });
    };

    const events = ['click', 'keydown', 'touchstart', 'pointerdown'];
    for (const type of events) {
      window.addEventListener(type, resumeHandler, { passive: true });
      this.interactionHandlers.push({ target: window, type, handler: resumeHandler });
      if (typeof document !== 'undefined') {
        document.addEventListener(type, resumeHandler, { passive: true });
        this.interactionHandlers.push({ target: document, type, handler: resumeHandler });
      }
    }
  }

  private cleanupAutoResume(): void {
    for (const { target, type, handler } of this.interactionHandlers) {
      target.removeEventListener(type, handler);
    }
    this.interactionHandlers = [];
  }

  /**
   * Gracefully resumes the AudioContext if suspended.
   */
  public async resume(): Promise<void> {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
        this.cleanupAutoResume();
      } catch (err) {
        console.warn('[SoundEngine] Resume error:', err);
      }
    }
  }

  public setMasterVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx && !this.isMutedState) {
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
    }
  }

  public setSfxVolume(vol: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
    }
  }

  public setVoiceVolume(vol: number): void {
    this.voiceVolume = Math.max(0, Math.min(1, vol));
    if (this.voiceGain && this.ctx) {
      this.voiceGain.gain.setValueAtTime(this.voiceVolume, this.ctx.currentTime);
    }
  }

  public setMuted(muted: boolean): void {
    this.isMutedState = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : this.masterVolume, this.ctx.currentTime);
    }
  }

  public isMuted(): boolean {
    return this.isMutedState;
  }

  public playSound(type: SoundEffectType): void {
    switch (type) {
      case 'PISTOL':
        this.playPistol();
        break;
      case 'HEAVY_MACHINE_GUN':
        this.playHeavyMachineGun();
        break;
      case 'FLAME_SHOT':
        this.playFlameShot();
        break;
      case 'GRENADE_LAUNCH':
        this.playGrenadeLaunch();
        break;
      case 'GRENADE_BOUNCE':
        this.playGrenadeBounce();
        break;
      case 'EXPLOSION':
        this.playExplosion();
        break;
      case 'KNIFE_SLASH':
        this.playKnifeSlash();
        break;
      case 'BULLET_HIT':
        this.playBulletHit();
        break;
      case 'ITEM_PICKUP':
        this.playItemPickup();
        break;
    }
  }

  public playVoice(clip: VoiceClipType): void {
    if (this.isMutedState) return;
    this.speech.playVoice(clip);
  }

  private canPlaySFX(): boolean {
    if (!this.ctx || !this.sfxGain || this.isMutedState) return false;
    if (this.activeVoiceCount >= this.maxActiveVoices) return false;
    return true;
  }

  private registerVoiceNode(node: AudioNode, duration: number): void {
    this.activeVoiceCount++;
    setTimeout(() => {
      this.activeVoiceCount = Math.max(0, this.activeVoiceCount - 1);
      try {
        node.disconnect();
      } catch {
        // Ignored
      }
    }, Math.max(50, Math.round(duration * 1000) + 50));
  }

  // ==========================================================================
  // PROCEDURAL SOUND EFFECT ROUTINES
  // ==========================================================================

  /**
   * 1. Pistol: Sharp high-frequency transient + low-mid punch.
   */
  public playPistol(): void {
    if (!this.canPlaySFX() || !this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // Transient Pitch Drop
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(850, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.045);

    oscGain.gain.setValueAtTime(0.85, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.05);
    this.registerVoiceNode(oscGain, 0.05);

    // High Punch Noise Burst (Bandpass 2200Hz, Q=2.5)
    if (this.whiteNoiseBuffer) {
      const noise = this.ctx.createBufferSource();
      const filter = this.ctx.createBiquadFilter();
      const noiseGain = this.ctx.createGain();

      noise.buffer = this.whiteNoiseBuffer;
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2200, t);
      filter.Q.setValueAtTime(2.5, t);

      noiseGain.gain.setValueAtTime(0.9, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.sfxGain);

      noise.start(t);
      noise.stop(t + 0.045);
      this.registerVoiceNode(noiseGain, 0.045);
    }

    // Low-mid weight thump
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(140, t);
    subOsc.frequency.exponentialRampToValueAtTime(45, t + 0.06);

    subGain.gain.setValueAtTime(0.7, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.065);

    subOsc.connect(subGain);
    subGain.connect(this.sfxGain);

    subOsc.start(t);
    subOsc.stop(t + 0.065);
    this.registerVoiceNode(subGain, 0.065);
  }

  /**
   * 2. Heavy Machine Gun: Rapid metallic snap + shell casing clatter.
   */
  public playHeavyMachineGun(): void {
    if (!this.canPlaySFX() || !this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // Metallic Snap: Overdriven sawtooth with fast sweep
    const osc = this.ctx.createOscillator();
    const shaper = this.ctx.createWaveShaper();
    const oscGain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(360, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.06);

    if (this.distortionCurve) {
      shaper.curve = this.distortionCurve;
    }

    oscGain.gain.setValueAtTime(0.88, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.065);

    osc.connect(shaper);
    shaper.connect(oscGain);
    oscGain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.065);
    this.registerVoiceNode(oscGain, 0.065);

    // Mechanical Bolt Click (Square pulse at 1800Hz)
    const click = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    click.type = 'square';
    click.frequency.setValueAtTime(1800, t);

    clickGain.gain.setValueAtTime(0.65, t);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.012);

    click.connect(clickGain);
    clickGain.connect(this.sfxGain);

    click.start(t);
    click.stop(t + 0.012);
    this.registerVoiceNode(clickGain, 0.012);

    // Shell Casing Clink: Delayed high sine chime
    const casingDelay = 0.075;
    const clink = this.ctx.createOscillator();
    const clinkGain = this.ctx.createGain();
    clink.type = 'sine';
    clink.frequency.setValueAtTime(3800, t + casingDelay);

    clinkGain.gain.setValueAtTime(0, t);
    clinkGain.gain.setValueAtTime(0.35, t + casingDelay);
    clinkGain.gain.exponentialRampToValueAtTime(0.001, t + casingDelay + 0.11);

    clink.connect(clinkGain);
    clinkGain.connect(this.sfxGain);

    clink.start(t + casingDelay);
    clink.stop(t + casingDelay + 0.11);
    this.registerVoiceNode(clinkGain, casingDelay + 0.11);
  }

  /**
   * 3. Flame Shot: White noise filtered whoosh + crackling low-end fire loop.
   */
  public playFlameShot(): void {
    if (!this.canPlaySFX() || !this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const duration = 0.38;

    // Parallel Resonant Filters for Roaring Fire
    if (this.brownNoiseBuffer) {
      const brown = this.ctx.createBufferSource();
      const bp1 = this.ctx.createBiquadFilter();
      const bp2 = this.ctx.createBiquadFilter();
      const noiseGain = this.ctx.createGain();

      brown.buffer = this.brownNoiseBuffer;
      bp1.type = 'bandpass';
      bp1.frequency.setValueAtTime(680, t);
      bp1.Q.setValueAtTime(3.8, t);

      bp2.type = 'bandpass';
      bp2.frequency.setValueAtTime(1300, t);
      bp2.Q.setValueAtTime(3.0, t);

      noiseGain.gain.setValueAtTime(0.01, t);
      noiseGain.gain.linearRampToValueAtTime(0.85, t + 0.04);
      noiseGain.gain.setValueAtTime(0.85, t + 0.22);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

      brown.connect(bp1);
      brown.connect(bp2);
      bp1.connect(noiseGain);
      bp2.connect(noiseGain);
      noiseGain.connect(this.sfxGain);

      brown.start(t);
      brown.stop(t + duration);
      this.registerVoiceNode(noiseGain, duration);
    }

    // Highpass Crackle Hiss
    if (this.whiteNoiseBuffer) {
      const white = this.ctx.createBufferSource();
      const hp = this.ctx.createBiquadFilter();
      const crackleGain = this.ctx.createGain();

      white.buffer = this.whiteNoiseBuffer;
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(4500, t);

      crackleGain.gain.setValueAtTime(0.01, t);
      crackleGain.gain.linearRampToValueAtTime(0.45, t + 0.03);
      crackleGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

      white.connect(hp);
      hp.connect(crackleGain);
      crackleGain.connect(this.sfxGain);

      white.start(t);
      white.stop(t + duration);
      this.registerVoiceNode(crackleGain, duration);
    }

    // Low Sub-Bass Body (55Hz)
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(55, t);

    subGain.gain.setValueAtTime(0.65, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    sub.connect(subGain);
    subGain.connect(this.sfxGain);

    sub.start(t);
    sub.stop(t + duration);
    this.registerVoiceNode(subGain, duration);
  }

  /**
   * 4. Grenade Launch: Thump pop sound.
   */
  public playGrenadeLaunch(): void {
    if (!this.canPlaySFX() || !this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // Pitch Drop Thump
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.085);

    gain.gain.setValueAtTime(0.9, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.09);
    this.registerVoiceNode(gain, 0.09);

    // Muffled Pop Noise
    if (this.pinkNoiseBuffer) {
      const noise = this.ctx.createBufferSource();
      const bp = this.ctx.createBiquadFilter();
      const noiseGain = this.ctx.createGain();

      noise.buffer = this.pinkNoiseBuffer;
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(320, t);
      bp.Q.setValueAtTime(2.2, t);

      noiseGain.gain.setValueAtTime(0.8, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.065);

      noise.connect(bp);
      bp.connect(noiseGain);
      noiseGain.connect(this.sfxGain);

      noise.start(t);
      noise.stop(t + 0.065);
      this.registerVoiceNode(noiseGain, 0.065);
    }
  }

  /**
   * 5. Grenade Bounce: High-pitch metallic ping.
   */
  public playGrenadeBounce(): void {
    if (!this.canPlaySFX() || !this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // Fundamental Metallic Ping (2500Hz)
    const ping = this.ctx.createOscillator();
    const pingGain = this.ctx.createGain();
    ping.type = 'sine';
    ping.frequency.setValueAtTime(2500, t);

    pingGain.gain.setValueAtTime(0.7, t);
    pingGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    ping.connect(pingGain);
    pingGain.connect(this.sfxGain);

    ping.start(t);
    ping.stop(t + 0.12);
    this.registerVoiceNode(pingGain, 0.12);

    // 2nd Harmonic Shimmer (5000Hz)
    const harm = this.ctx.createOscillator();
    const harmGain = this.ctx.createGain();
    harm.type = 'sine';
    harm.frequency.setValueAtTime(5000, t);

    harmGain.gain.setValueAtTime(0.35, t);
    harmGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    harm.connect(harmGain);
    harmGain.connect(this.sfxGain);

    harm.start(t);
    harm.stop(t + 0.06);
    this.registerVoiceNode(harmGain, 0.06);
  }

  /**
   * 6. Explosion: Low-pass filtered noise blast with exponential decay and sub-bass rumble.
   */
  public playExplosion(isLarge: boolean = false): void {
    if (!this.canPlaySFX() || !this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const duration = isLarge ? 1.6 : 1.1;

    // Swept Lowpass Filtered Pink Noise Blast
    if (this.pinkNoiseBuffer) {
      const blast = this.ctx.createBufferSource();
      const lp = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      blast.buffer = this.pinkNoiseBuffer;
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(isLarge ? 2400 : 1900, t);
      lp.frequency.exponentialRampToValueAtTime(65, t + duration);
      lp.Q.setValueAtTime(3.2, t);

      gain.gain.setValueAtTime(1.0, t);
      gain.gain.setValueAtTime(0.95, t + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

      blast.connect(lp);
      lp.connect(gain);
      gain.connect(this.sfxGain);

      blast.start(t);
      blast.stop(t + duration);
      this.registerVoiceNode(gain, duration);
    }

    // Ground-Shaking Sub-Bass Oscillator (160Hz -> 25Hz)
    const sub = this.ctx.createOscillator();
    const shaper = this.ctx.createWaveShaper();
    const subGain = this.ctx.createGain();

    sub.type = 'sine';
    sub.frequency.setValueAtTime(isLarge ? 175 : 150, t);
    sub.frequency.exponentialRampToValueAtTime(26, t + (isLarge ? 0.75 : 0.5));

    if (this.distortionCurve) {
      shaper.curve = this.distortionCurve;
    }

    subGain.gain.setValueAtTime(0.95, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + (isLarge ? 0.8 : 0.55));

    sub.connect(shaper);
    shaper.connect(subGain);
    subGain.connect(this.sfxGain);

    sub.start(t);
    sub.stop(t + (isLarge ? 0.8 : 0.55));
    this.registerVoiceNode(subGain, isLarge ? 0.8 : 0.55);
  }

  /**
   * 7. Knife Slash: Swift high-pass filtered noise whoosh.
   */
  public playKnifeSlash(): void {
    if (!this.canPlaySFX() || !this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const duration = 0.14;

    if (this.whiteNoiseBuffer) {
      const noise = this.ctx.createBufferSource();
      const hp = this.ctx.createBiquadFilter();
      const bp = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      noise.buffer = this.whiteNoiseBuffer;

      hp.type = 'highpass';
      hp.frequency.setValueAtTime(1500, t);
      hp.frequency.exponentialRampToValueAtTime(550, t + duration);

      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(2800, t);
      bp.Q.setValueAtTime(1.8, t);

      gain.gain.setValueAtTime(0.01, t);
      gain.gain.linearRampToValueAtTime(0.88, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

      noise.connect(hp);
      hp.connect(bp);
      bp.connect(gain);
      gain.connect(this.sfxGain);

      noise.start(t);
      noise.stop(t + duration);
      this.registerVoiceNode(gain, duration);
    }

    // Slicing Air Tone (Sine chirp 1200Hz -> 650Hz)
    const air = this.ctx.createOscillator();
    const airGain = this.ctx.createGain();
    air.type = 'sine';
    air.frequency.setValueAtTime(1200, t);
    air.frequency.exponentialRampToValueAtTime(650, t + duration);

    airGain.gain.setValueAtTime(0.28, t);
    airGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    air.connect(airGain);
    airGain.connect(this.sfxGain);

    air.start(t);
    air.stop(t + duration);
    this.registerVoiceNode(airGain, duration);
  }

  /**
   * 8. Bullet Hit: Metal ricochet or flesh impact punch.
   */
  public playBulletHit(isFlesh: boolean = false): void {
    if (!this.canPlaySFX() || !this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    if (isFlesh) {
      // Flesh Punch: Low-mid thump + fleshy thud
      const thump = this.ctx.createOscillator();
      const thumpGain = this.ctx.createGain();
      thump.type = 'sine';
      thump.frequency.setValueAtTime(160, t);
      thump.frequency.exponentialRampToValueAtTime(40, t + 0.055);

      thumpGain.gain.setValueAtTime(0.85, t);
      thumpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

      thump.connect(thumpGain);
      thumpGain.connect(this.sfxGain);

      thump.start(t);
      thump.stop(t + 0.06);
      this.registerVoiceNode(thumpGain, 0.06);

      if (this.pinkNoiseBuffer) {
        const noise = this.ctx.createBufferSource();
        const bp = this.ctx.createBiquadFilter();
        const noiseGain = this.ctx.createGain();

        noise.buffer = this.pinkNoiseBuffer;
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(750, t);
        bp.Q.setValueAtTime(1.5, t);

        noiseGain.gain.setValueAtTime(0.75, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

        noise.connect(bp);
        bp.connect(noiseGain);
        noiseGain.connect(this.sfxGain);

        noise.start(t);
        noise.stop(t + 0.05);
        this.registerVoiceNode(noiseGain, 0.05);
      }
    } else {
      // Metal Ricochet: High-pitch chirping sweep (1800Hz -> 3600Hz -> 900Hz)
      const chirp = this.ctx.createOscillator();
      const chirpGain = this.ctx.createGain();
      chirp.type = 'sine';
      chirp.frequency.setValueAtTime(1800, t);
      chirp.frequency.exponentialRampToValueAtTime(3600, t + 0.03);
      chirp.frequency.exponentialRampToValueAtTime(900, t + 0.085);

      chirpGain.gain.setValueAtTime(0.72, t);
      chirpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

      chirp.connect(chirpGain);
      chirpGain.connect(this.sfxGain);

      chirp.start(t);
      chirp.stop(t + 0.09);
      this.registerVoiceNode(chirpGain, 0.09);

      // Impact Clang Transient
      if (this.whiteNoiseBuffer) {
        const noise = this.ctx.createBufferSource();
        const bp = this.ctx.createBiquadFilter();
        const noiseGain = this.ctx.createGain();

        noise.buffer = this.whiteNoiseBuffer;
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(3200, t);
        bp.Q.setValueAtTime(4.0, t);

        noiseGain.gain.setValueAtTime(0.8, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

        noise.connect(bp);
        bp.connect(noiseGain);
        noiseGain.connect(this.sfxGain);

        noise.start(t);
        noise.stop(t + 0.04);
        this.registerVoiceNode(noiseGain, 0.04);
      }
    }
  }

  /**
   * 9. Item Pickup: Retro arcade ascending arpeggio (C5 -> E5 -> G5 -> C6).
   */
  public playItemPickup(): void {
    if (!this.canPlaySFX() || !this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const notes = [
      { freq: 523.25, time: 0.0 },   // C5
      { freq: 659.25, time: 0.035 }, // E5
      { freq: 783.99, time: 0.070 }, // G5
      { freq: 1046.5, time: 0.105 }, // C6
    ];

    const noteDuration = 0.048;

    for (const note of notes) {
      const noteTime = t + note.time;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      // Authentic retro pulse/triangle arcade tone
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.freq, noteTime);

      gain.gain.setValueAtTime(0, t);
      gain.gain.setValueAtTime(0.65, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + noteDuration);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(noteTime);
      osc.stop(noteTime + noteDuration);
      this.registerVoiceNode(gain, note.time + noteDuration);
    }
  }
}
