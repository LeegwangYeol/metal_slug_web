/**
 * AudioTypes.ts - Type definitions for Metal Slug Web Audio Engine and Speech Synthesizer.
 */

export type SoundEffectType =
  | 'PISTOL'
  | 'HEAVY_MACHINE_GUN'
  | 'FLAME_SHOT'
  | 'GRENADE_LAUNCH'
  | 'GRENADE_BOUNCE'
  | 'EXPLOSION'
  | 'KNIFE_SLASH'
  | 'BULLET_HIT'
  | 'ITEM_PICKUP';

export type VoiceClipType =
  | 'HEAVY_MACHINE_GUN'
  | 'FLAME_SHOT'
  | 'OK'
  | 'MISSION_COMPLETE'
  | 'THANK_YOU';

export interface AudioConfig {
  masterVolume?: number; // 0.0 to 1.0 (default 0.8)
  sfxVolume?: number;    // 0.0 to 1.0 (default 0.9)
  voiceVolume?: number;  // 0.0 to 1.0 (default 1.0)
  muted?: boolean;       // default false
}

export interface FormantTarget {
  f1: number; // Hz
  f2: number; // Hz
  f3: number; // Hz
  f4: number; // Hz
  b1?: number; // Bandwidth Hz
  b2?: number; // Bandwidth Hz
  b3?: number; // Bandwidth Hz
  b4?: number; // Bandwidth Hz
}

export interface PhonemeSegment {
  duration: number; // Seconds
  formants: FormantTarget;
  pitchStart: number; // Hz (fundamental frequency f0)
  pitchEnd: number;   // Hz (fundamental frequency f0)
  voicedGain: number; // 0.0 to 1.0 (glottal pulse amplitude)
  noiseGain: number;  // 0.0 to 1.0 (aspiration/fricative noise)
  noiseBandpass?: { freq: number; q: number }; // Optional noise color filter
  isPlosiveBurst?: boolean; // Sharp impulse transient
}

export interface PreRenderedVoiceClip {
  clip: VoiceClipType;
  duration: number;
  buffer: AudioBuffer | null;
  pcmData: Float32Array;
  sampleRate: number;
}

export interface ISpeechSynthesizer {
  isReady: boolean;
  preRenderAll(): void;
  playVoice(clip: VoiceClipType): AudioBufferSourceNode | null;
  playHeavyMachineGun(): AudioBufferSourceNode | null;
  playFlameShot(): AudioBufferSourceNode | null;
  playOk(): AudioBufferSourceNode | null;
  playMissionComplete(): AudioBufferSourceNode | null;
  playThankYou(): AudioBufferSourceNode | null;
  getVoiceData(clip: VoiceClipType): PreRenderedVoiceClip | undefined;
}

export interface ISoundEngine {
  readonly ctx: AudioContext | null;
  readonly isReady: boolean;
  readonly speech: ISpeechSynthesizer;
  resume(): Promise<void>;
  setMasterVolume(volume: number): void;
  setSfxVolume(volume: number): void;
  setVoiceVolume(volume: number): void;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
  playSound(type: SoundEffectType): void;
  playPistol(): void;
  playHeavyMachineGun(): void;
  playFlameShot(): void;
  playGrenadeLaunch(): void;
  playGrenadeBounce(): void;
  playExplosion(isLarge?: boolean): void;
  playKnifeSlash(): void;
  playBulletHit(isFlesh?: boolean): void;
  playItemPickup(): void;
}
