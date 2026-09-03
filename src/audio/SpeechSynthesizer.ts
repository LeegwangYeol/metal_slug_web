/**
 * SpeechSynthesizer.ts - Source-Filter Formant Speech Announcer for Metal Slug Web.
 *
 * Implements an authentic source-filter vocal tract acoustic model:
 * 1. Glottal pulse excitation train (differentiated Rosenberg glottal model for voiced sounds)
 * 2. Unvoiced noise generator (shaped Gaussian/uniform noise for fricatives and plosives)
 * 3. 4-band Biquad Bandpass Formant Filters (F1, F2, F3, F4) modeling vocal tract resonances
 * 4. Pre-rendered AudioBuffers on initialization for zero-latency arcade voice callouts:
 *    - "HEAVY MACHINE GUN!"
 *    - "FLAME SHOT!"
 *    - "OK!"
 *    - "MISSION COMPLETE!"
 *    - "THANK YOU!" (POW rescue)
 */

import {
  ISpeechSynthesizer,
  PhonemeSegment,
  PreRenderedVoiceClip,
  VoiceClipType,
} from './AudioTypes';

/**
 * 2nd-Order Digital IIR Biquad Bandpass Filter with constant 0dB peak gain.
 */
class DigitalBiquadBandpass {
  private b0 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;

  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;

  public setCoefficients(freq: number, bandwidth: number, sampleRate: number): void {
    const nyquist = sampleRate * 0.49;
    const f0 = Math.max(40, Math.min(freq, nyquist));
    const bw = Math.max(20, Math.min(bandwidth, f0 * 1.8));
    const q = f0 / bw;

    const w0 = (2 * Math.PI * f0) / sampleRate;
    const alpha = Math.sin(w0) / (2 * q);
    const cosW0 = Math.cos(w0);

    const a0 = 1 + alpha;
    this.b0 = alpha / a0;
    this.b2 = -alpha / a0;
    this.a1 = (-2 * cosW0) / a0;
    this.a2 = (1 - alpha) / a0;
  }

  public process(x: number): number {
    const y = this.b0 * x + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = isFinite(y) ? y : 0;
    return this.y1;
  }

  public reset(): void {
    this.x1 = 0;
    this.x2 = 0;
    this.y1 = 0;
    this.y2 = 0;
  }
}

export class SpeechSynthesizer implements ISpeechSynthesizer {
  public ctx: AudioContext | null = null;
  public outputNode: AudioNode | null = null;
  public isReady = false;

  private renderedClips: Map<VoiceClipType, PreRenderedVoiceClip> = new Map();
  private sampleRate = 44100;

  constructor(ctx?: AudioContext | null, outputNode?: AudioNode | null) {
    this.ctx = ctx || null;
    this.outputNode = outputNode || null;
    if (this.ctx && typeof this.ctx.sampleRate === 'number') {
      this.sampleRate = this.ctx.sampleRate;
    }
    this.preRenderAll();
  }

  /**
   * Set or update AudioContext and output destination node.
   */
  public setContext(ctx: AudioContext, outputNode?: AudioNode): void {
    this.ctx = ctx;
    this.sampleRate = ctx.sampleRate || 44100;
    if (outputNode) {
      this.outputNode = outputNode;
    }
    // Convert cached PCM data to native AudioBuffers
    this.createAudioBuffers();
  }

  /**
   * Pre-renders all 5 iconic voice clips into memory immediately.
   */
  public preRenderAll(): void {
    const clips: VoiceClipType[] = [
      'HEAVY_MACHINE_GUN',
      'FLAME_SHOT',
      'OK',
      'MISSION_COMPLETE',
      'THANK_YOU',
    ];

    for (const clip of clips) {
      const pcm = this.synthesizeClipPCM(clip, this.sampleRate);
      const duration = pcm.length / this.sampleRate;

      this.renderedClips.set(clip, {
        clip,
        duration,
        buffer: null,
        pcmData: pcm,
        sampleRate: this.sampleRate,
      });
    }

    if (this.ctx) {
      this.createAudioBuffers();
    }

    this.isReady = true;
  }

  /**
   * Transfer Float32 PCM arrays into Web Audio AudioBuffers.
   */
  private createAudioBuffers(): void {
    if (!this.ctx) return;

    for (const [clip, item] of this.renderedClips.entries()) {
      try {
        const audioBuffer = this.ctx.createBuffer(1, item.pcmData.length, this.sampleRate);
        audioBuffer.getChannelData(0).set(item.pcmData);
        item.buffer = audioBuffer;
        this.renderedClips.set(clip, item);
      } catch (err) {
        console.warn(`[SpeechSynthesizer] Failed to create AudioBuffer for ${clip}:`, err);
      }
    }
  }

  /**
   * Play pre-rendered voice clip with zero latency.
   */
  public playVoice(clip: VoiceClipType): AudioBufferSourceNode | null {
    if (!this.ctx) return null;

    let item = this.renderedClips.get(clip);
    if (!item) {
      this.preRenderAll();
      item = this.renderedClips.get(clip);
    }

    if (!item) return null;

    // Lazily create buffer if it wasn't populated yet
    if (!item.buffer) {
      try {
        item.buffer = this.ctx.createBuffer(1, item.pcmData.length, this.sampleRate);
        item.buffer.getChannelData(0).set(item.pcmData);
      } catch {
        return null;
      }
    }

    try {
      const source = this.ctx.createBufferSource();
      source.buffer = item.buffer;

      if (this.outputNode) {
        source.connect(this.outputNode);
      } else {
        source.connect(this.ctx.destination);
      }

      source.start(0);
      return source;
    } catch (err) {
      console.warn(`[SpeechSynthesizer] Playback error for ${clip}:`, err);
      return null;
    }
  }

  public playHeavyMachineGun(): AudioBufferSourceNode | null {
    return this.playVoice('HEAVY_MACHINE_GUN');
  }

  public playFlameShot(): AudioBufferSourceNode | null {
    return this.playVoice('FLAME_SHOT');
  }

  public playOk(): AudioBufferSourceNode | null {
    return this.playVoice('OK');
  }

  public playMissionComplete(): AudioBufferSourceNode | null {
    return this.playVoice('MISSION_COMPLETE');
  }

  public playThankYou(): AudioBufferSourceNode | null {
    return this.playVoice('THANK_YOU');
  }

  public getVoiceData(clip: VoiceClipType): PreRenderedVoiceClip | undefined {
    return this.renderedClips.get(clip);
  }

  /**
   * Core source-filter speech synthesis engine.
   * Synthesizes PCM samples in Float32Array from phoneme sequences.
   */
  public synthesizeClipPCM(clip: VoiceClipType, sampleRate: number): Float32Array {
    const segments = this.getPhonemesForClip(clip);
    let totalSamples = 0;
    for (const seg of segments) {
      totalSamples += Math.round(seg.duration * sampleRate);
    }

    const output = new Float32Array(totalSamples);
    if (totalSamples === 0) return output;

    // Four parallel digital biquad bandpass formant filters
    const f1Filter = new DigitalBiquadBandpass();
    const f2Filter = new DigitalBiquadBandpass();
    const f3Filter = new DigitalBiquadBandpass();
    const f4Filter = new DigitalBiquadBandpass();
    const noiseFilter = new DigitalBiquadBandpass();

    // Glottal excitation phase
    let glottalPhase = 0;
    let prevGlottal = 0;
    let sampleOffset = 0;

    // Relative gain weights for formants (calibrated for masculine arcade announcer)
    const g1 = 1.0;
    const g2 = 0.72;
    const g3 = 0.42;
    const g4 = 0.22;

    // Highpass DC blocking filter state
    let dcX1 = 0;
    let dcY1 = 0;

    for (let segIdx = 0; segIdx < segments.length; segIdx++) {
      const seg = segments[segIdx];
      const nextSeg = segments[segIdx + 1] || seg;
      const segLength = Math.round(seg.duration * sampleRate);

      for (let i = 0; i < segLength; i++) {
        const tRatio = segLength > 1 ? i / segLength : 0;
        const globalIdx = sampleOffset + i;

        // Smooth interpolated pitch (f0)
        const currentPitch = seg.pitchStart + (seg.pitchEnd - seg.pitchStart) * tRatio;

        // Smooth interpolated formant frequencies
        const curF1 = seg.formants.f1 + (nextSeg.formants.f1 - seg.formants.f1) * tRatio * 0.4;
        const curF2 = seg.formants.f2 + (nextSeg.formants.f2 - seg.formants.f2) * tRatio * 0.4;
        const curF3 = seg.formants.f3 + (nextSeg.formants.f3 - seg.formants.f3) * tRatio * 0.3;
        const curF4 = seg.formants.f4 + (nextSeg.formants.f4 - seg.formants.f4) * tRatio * 0.2;

        const b1 = seg.formants.b1 || 70;
        const b2 = seg.formants.b2 || 90;
        const b3 = seg.formants.b3 || 130;
        const b4 = seg.formants.b4 || 180;

        // Update biquad coefficients
        f1Filter.setCoefficients(curF1, b1, sampleRate);
        f2Filter.setCoefficients(curF2, b2, sampleRate);
        f3Filter.setCoefficients(curF3, b3, sampleRate);
        f4Filter.setCoefficients(curF4, b4, sampleRate);

        // 1. Voiced Glottal Excitation
        let glottalSample = 0;
        if (seg.voicedGain > 0 && currentPitch > 20) {
          const phaseInc = currentPitch / sampleRate;
          glottalPhase += phaseInc;
          if (glottalPhase >= 1.0) {
            glottalPhase -= 1.0;
          }

          // Differentiated Rosenberg glottal model
          let flow = 0;
          if (glottalPhase < 0.42) {
            // Opening phase
            flow = 0.5 * (1 - Math.cos((Math.PI * glottalPhase) / 0.42));
          } else if (glottalPhase < 0.58) {
            // Sharp closing phase (negative peak in flow derivative)
            flow = Math.cos((Math.PI * 0.5 * (glottalPhase - 0.42)) / 0.16);
          } else {
            // Closed glottis
            flow = 0;
          }

          // Differentiate to get acoustic volume velocity derivative
          const dFlow = flow - prevGlottal;
          prevGlottal = flow;
          glottalSample = dFlow * 4.5 * seg.voicedGain;
        } else {
          glottalPhase = 0;
          prevGlottal = 0;
        }

        // 2. Unvoiced Noise Excitation
        let noiseSample = 0;
        if (seg.noiseGain > 0) {
          const rawNoise = Math.random() * 2.0 - 1.0;
          if (seg.noiseBandpass) {
            noiseFilter.setCoefficients(
              seg.noiseBandpass.freq,
              seg.noiseBandpass.freq / seg.noiseBandpass.q,
              sampleRate
            );
            noiseSample = noiseFilter.process(rawNoise) * seg.noiseGain * 2.0;
          } else {
            noiseSample = rawNoise * seg.noiseGain * 0.9;
          }

          // Add plosive burst impulse at the start of plosives
          if (seg.isPlosiveBurst && i < Math.min(segLength, 80)) {
            const burstEnv = Math.exp(-i / 15);
            noiseSample += (Math.random() * 2.0 - 1.0) * burstEnv * 2.5;
          }
        }

        // Combined source excitation
        const excitation = glottalSample + noiseSample;

        // 3. 4-Band Parallel Formant Filtering
        const y1 = f1Filter.process(excitation);
        const y2 = f2Filter.process(excitation);
        const y3 = f3Filter.process(excitation);
        const y4 = f4Filter.process(excitation);

        const formantSum = g1 * y1 + g2 * y2 + g3 * y3 + g4 * y4;

        // 4. DC Blocking Filter (cutoff ~35Hz)
        const dcBlocked = formantSum - dcX1 + 0.995 * dcY1;
        dcX1 = formantSum;
        dcY1 = dcBlocked;

        // 5. Arcade Cabinet Overdrive Saturation (tanh)
        const saturated = Math.tanh(1.55 * dcBlocked);

        output[globalIdx] = saturated;
      }

      sampleOffset += segLength;
    }

    // Edge fade-in and fade-out to eliminate buffer boundary pops
    const fadeSamples = Math.min(250, Math.floor(output.length * 0.05));
    for (let i = 0; i < fadeSamples; i++) {
      const taper = 0.5 * (1 - Math.cos((Math.PI * i) / fadeSamples));
      output[i] *= taper;
      output[output.length - 1 - i] *= taper;
    }

    // Normalize peak to 0.88 headroom
    let maxAmp = 0;
    for (let i = 0; i < output.length; i++) {
      const abs = Math.abs(output[i]);
      if (abs > maxAmp) maxAmp = abs;
    }

    if (maxAmp > 0.001) {
      const normFactor = 0.88 / maxAmp;
      for (let i = 0; i < output.length; i++) {
        output[i] *= normFactor;
      }
    }

    return output;
  }

  /**
   * Phonetic sequence definitions for the 5 arcade announcer voice clips.
   */
  private getPhonemesForClip(clip: VoiceClipType): PhonemeSegment[] {
    switch (clip) {
      case 'HEAVY_MACHINE_GUN':
        return [
          // "H" - aspiration noise
          {
            duration: 0.06,
            formants: { f1: 500, f2: 1700, f3: 2500, f4: 3500 },
            pitchStart: 120,
            pitchEnd: 124,
            voicedGain: 0.0,
            noiseGain: 0.75,
            noiseBandpass: { freq: 2200, q: 1.5 },
          },
          // "EA" (/ɛ/ in heavy)
          {
            duration: 0.12,
            formants: { f1: 560, f2: 1820, f3: 2580, f4: 3500 },
            pitchStart: 124,
            pitchEnd: 128,
            voicedGain: 0.88,
            noiseGain: 0.05,
          },
          // "V" (/v/)
          {
            duration: 0.065,
            formants: { f1: 320, f2: 1350, f3: 2350, f4: 3400 },
            pitchStart: 124,
            pitchEnd: 122,
            voicedGain: 0.65,
            noiseGain: 0.28,
          },
          // "Y" (/i/ in heavy)
          {
            duration: 0.085,
            formants: { f1: 280, f2: 2280, f3: 2880, f4: 3600 },
            pitchStart: 122,
            pitchEnd: 120,
            voicedGain: 0.82,
            noiseGain: 0.02,
          },
          // "M" (/m/ in machine)
          {
            duration: 0.065,
            formants: { f1: 250, f2: 1050, f3: 2200, f4: 3300 },
            pitchStart: 120,
            pitchEnd: 122,
            voicedGain: 0.78,
            noiseGain: 0.0,
          },
          // "A" (/ə/ neutral schwa)
          {
            duration: 0.055,
            formants: { f1: 500, f2: 1520, f3: 2520, f4: 3500 },
            pitchStart: 122,
            pitchEnd: 125,
            voicedGain: 0.82,
            noiseGain: 0.02,
          },
          // "SH" (/ʃ/ fricative)
          {
            duration: 0.115,
            formants: { f1: 340, f2: 2450, f3: 3850, f4: 4800 },
            pitchStart: 125,
            pitchEnd: 132,
            voicedGain: 0.0,
            noiseGain: 0.95,
            noiseBandpass: { freq: 3500, q: 2.2 },
          },
          // "EE" (/iː/ stressed vowel)
          {
            duration: 0.155,
            formants: { f1: 275, f2: 2320, f3: 2920, f4: 3650 },
            pitchStart: 135,
            pitchEnd: 140,
            voicedGain: 0.94,
            noiseGain: 0.02,
          },
          // "N" (/n/)
          {
            duration: 0.075,
            formants: { f1: 280, f2: 1550, f3: 2600, f4: 3400 },
            pitchStart: 135,
            pitchEnd: 128,
            voicedGain: 0.72,
            noiseGain: 0.0,
          },
          // Stop gap
          {
            duration: 0.045,
            formants: { f1: 250, f2: 1400, f3: 2400, f4: 3300 },
            pitchStart: 120,
            pitchEnd: 120,
            voicedGain: 0.0,
            noiseGain: 0.0,
          },
          // "G" (/ɡ/ velar burst)
          {
            duration: 0.045,
            formants: { f1: 300, f2: 1850, f3: 2650, f4: 3450 },
            pitchStart: 132,
            pitchEnd: 132,
            voicedGain: 0.55,
            noiseGain: 0.45,
            isPlosiveBurst: true,
          },
          // "U" (/ʌ/ in gun - punchy and commanding)
          {
            duration: 0.22,
            formants: { f1: 650, f2: 1240, f3: 2520, f4: 3500 },
            pitchStart: 136,
            pitchEnd: 98,
            voicedGain: 0.96,
            noiseGain: 0.03,
          },
          // "N" (/n/ lingering tail)
          {
            duration: 0.17,
            formants: { f1: 280, f2: 1450, f3: 2450, f4: 3350 },
            pitchStart: 96,
            pitchEnd: 86,
            voicedGain: 0.68,
            noiseGain: 0.0,
          },
        ];

      case 'FLAME_SHOT':
        return [
          // "F" (/f/ labiodental noise)
          {
            duration: 0.08,
            formants: { f1: 420, f2: 1520, f3: 2620, f4: 3600 },
            pitchStart: 125,
            pitchEnd: 128,
            voicedGain: 0.0,
            noiseGain: 0.88,
            noiseBandpass: { freq: 2800, q: 1.2 },
          },
          // "L" (/l/ liquid)
          {
            duration: 0.065,
            formants: { f1: 380, f2: 1120, f3: 2600, f4: 3400 },
            pitchStart: 128,
            pitchEnd: 132,
            voicedGain: 0.78,
            noiseGain: 0.02,
          },
          // "A" (/eɪ/ diphthong in flame)
          {
            duration: 0.21,
            formants: { f1: 520, f2: 1980, f3: 2650, f4: 3550 },
            pitchStart: 135,
            pitchEnd: 126,
            voicedGain: 0.94,
            noiseGain: 0.02,
          },
          // "M" (/m/ closure)
          {
            duration: 0.085,
            formants: { f1: 250, f2: 1050, f3: 2200, f4: 3300 },
            pitchStart: 122,
            pitchEnd: 116,
            voicedGain: 0.76,
            noiseGain: 0.0,
          },
          // Brief silence
          {
            duration: 0.04,
            formants: { f1: 280, f2: 1200, f3: 2300, f4: 3300 },
            pitchStart: 115,
            pitchEnd: 115,
            voicedGain: 0.0,
            noiseGain: 0.0,
          },
          // "SH" (/ʃ/ explosive fricative)
          {
            duration: 0.125,
            formants: { f1: 350, f2: 2450, f3: 3850, f4: 4800 },
            pitchStart: 122,
            pitchEnd: 135,
            voicedGain: 0.0,
            noiseGain: 0.96,
            noiseBandpass: { freq: 3600, q: 2.0 },
          },
          // "O" (/ɒ/ in shot)
          {
            duration: 0.19,
            formants: { f1: 680, f2: 1060, f3: 2520, f4: 3500 },
            pitchStart: 126,
            pitchEnd: 104,
            voicedGain: 0.95,
            noiseGain: 0.03,
          },
          // "T" (/t/ stop and sharp transient)
          {
            duration: 0.15,
            formants: { f1: 300, f2: 1850, f3: 3950, f4: 4800 },
            pitchStart: 100,
            pitchEnd: 90,
            voicedGain: 0.0,
            noiseGain: 0.85,
            noiseBandpass: { freq: 4200, q: 2.8 },
            isPlosiveBurst: true,
          },
        ];

      case 'OK':
        return [
          // "O" (/oʊ/ upbeat, rising)
          {
            duration: 0.16,
            formants: { f1: 440, f2: 980, f3: 2420, f4: 3400 },
            pitchStart: 116,
            pitchEnd: 132,
            voicedGain: 0.9,
            noiseGain: 0.02,
          },
          // "K" (/k/ plosive)
          {
            duration: 0.055,
            formants: { f1: 300, f2: 1980, f3: 2850, f4: 3650 },
            pitchStart: 132,
            pitchEnd: 135,
            voicedGain: 0.0,
            noiseGain: 0.82,
            noiseBandpass: { freq: 2400, q: 2.5 },
            isPlosiveBurst: true,
          },
          // "AY" (/eɪ/ cheerful bright vowel)
          {
            duration: 0.26,
            formants: { f1: 460, f2: 2150, f3: 2700, f4: 3600 },
            pitchStart: 148,
            pitchEnd: 132,
            voicedGain: 0.95,
            noiseGain: 0.02,
          },
        ];

      case 'MISSION_COMPLETE':
        return [
          // "M"
          {
            duration: 0.065,
            formants: { f1: 250, f2: 1050, f3: 2200, f4: 3300 },
            pitchStart: 116,
            pitchEnd: 120,
            voicedGain: 0.78,
            noiseGain: 0.0,
          },
          // "I" (/ɪ/)
          {
            duration: 0.095,
            formants: { f1: 390, f2: 1980, f3: 2620, f4: 3500 },
            pitchStart: 122,
            pitchEnd: 126,
            voicedGain: 0.88,
            noiseGain: 0.02,
          },
          // "SH" (/ʃ/)
          {
            duration: 0.095,
            formants: { f1: 350, f2: 2450, f3: 3850, f4: 4800 },
            pitchStart: 124,
            pitchEnd: 126,
            voicedGain: 0.0,
            noiseGain: 0.92,
            noiseBandpass: { freq: 3500, q: 2.0 },
          },
          // "U" (/ə/ schwa)
          {
            duration: 0.055,
            formants: { f1: 500, f2: 1520, f3: 2520, f4: 3500 },
            pitchStart: 120,
            pitchEnd: 118,
            voicedGain: 0.8,
            noiseGain: 0.02,
          },
          // "N" (/n/)
          {
            duration: 0.065,
            formants: { f1: 280, f2: 1550, f3: 2600, f4: 3400 },
            pitchStart: 116,
            pitchEnd: 114,
            voicedGain: 0.72,
            noiseGain: 0.0,
          },
          // Pause between "Mission" and "Complete"
          {
            duration: 0.065,
            formants: { f1: 250, f2: 1200, f3: 2300, f4: 3300 },
            pitchStart: 112,
            pitchEnd: 112,
            voicedGain: 0.0,
            noiseGain: 0.0,
          },
          // "K" (/k/)
          {
            duration: 0.045,
            formants: { f1: 300, f2: 1980, f3: 2850, f4: 3650 },
            pitchStart: 122,
            pitchEnd: 122,
            voicedGain: 0.0,
            noiseGain: 0.8,
            isPlosiveBurst: true,
          },
          // "OM" (/ɒm/)
          {
            duration: 0.125,
            formants: { f1: 600, f2: 1120, f3: 2420, f4: 3420 },
            pitchStart: 122,
            pitchEnd: 125,
            voicedGain: 0.86,
            noiseGain: 0.02,
          },
          // "P" (/p/)
          {
            duration: 0.045,
            formants: { f1: 300, f2: 1250, f3: 2400, f4: 3400 },
            pitchStart: 125,
            pitchEnd: 126,
            voicedGain: 0.0,
            noiseGain: 0.75,
            isPlosiveBurst: true,
          },
          // "L" (/l/)
          {
            duration: 0.065,
            formants: { f1: 380, f2: 1220, f3: 2620, f4: 3420 },
            pitchStart: 128,
            pitchEnd: 135,
            voicedGain: 0.82,
            noiseGain: 0.02,
          },
          // "EET" (/iː/ heroic climax)
          {
            duration: 0.31,
            formants: { f1: 275, f2: 2360, f3: 2950, f4: 3680 },
            pitchStart: 144,
            pitchEnd: 128,
            voicedGain: 0.95,
            noiseGain: 0.02,
          },
          // "T" (/t/ crisp closure + reverb decay)
          {
            duration: 0.18,
            formants: { f1: 300, f2: 1850, f3: 3950, f4: 4800 },
            pitchStart: 110,
            pitchEnd: 95,
            voicedGain: 0.0,
            noiseGain: 0.78,
            noiseBandpass: { freq: 4000, q: 2.5 },
            isPlosiveBurst: true,
          },
        ];

      case 'THANK_YOU':
        return [
          // "TH" (/θ/ dental fricative)
          {
            duration: 0.075,
            formants: { f1: 400, f2: 1620, f3: 2820, f4: 3800 },
            pitchStart: 126,
            pitchEnd: 130,
            voicedGain: 0.0,
            noiseGain: 0.84,
            noiseBandpass: { freq: 3200, q: 1.4 },
          },
          // "A" (/æ/ in thank)
          {
            duration: 0.175,
            formants: { f1: 690, f2: 1680, f3: 2480, f4: 3500 },
            pitchStart: 136,
            pitchEnd: 125,
            voicedGain: 0.92,
            noiseGain: 0.02,
          },
          // "NK" (/ŋk/ nasal + velar closure)
          {
            duration: 0.105,
            formants: { f1: 280, f2: 1920, f3: 2720, f4: 3600 },
            pitchStart: 124,
            pitchEnd: 120,
            voicedGain: 0.65,
            noiseGain: 0.35,
          },
          // Brief pause
          {
            duration: 0.035,
            formants: { f1: 250, f2: 1400, f3: 2400, f4: 3400 },
            pitchStart: 120,
            pitchEnd: 120,
            voicedGain: 0.0,
            noiseGain: 0.0,
          },
          // "Y" (/j/ glide)
          {
            duration: 0.085,
            formants: { f1: 280, f2: 2280, f3: 2850, f4: 3600 },
            pitchStart: 138,
            pitchEnd: 144,
            voicedGain: 0.88,
            noiseGain: 0.02,
          },
          // "OU" (/uː/ warm grateful finish)
          {
            duration: 0.27,
            formants: { f1: 320, f2: 960, f3: 2320, f4: 3400 },
            pitchStart: 145,
            pitchEnd: 118,
            voicedGain: 0.94,
            noiseGain: 0.02,
          },
          // Breath tail
          {
            duration: 0.09,
            formants: { f1: 350, f2: 1200, f3: 2400, f4: 3400 },
            pitchStart: 110,
            pitchEnd: 95,
            voicedGain: 0.3,
            noiseGain: 0.15,
          },
        ];
    }
  }
}
