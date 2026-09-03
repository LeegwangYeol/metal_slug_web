## 2026-09-03T03:19:31Z
You are worker_m5.
Your working directory is /Users/user/src/fullmetalslug/.agents/worker_m5/.
Project workspace root is /Users/user/src/fullmetalslug/.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Read these files before starting:
- /Users/user/src/fullmetalslug/ORIGINAL_REQUEST.md
- /Users/user/src/fullmetalslug/COLLABORATION.md
- /Users/user/src/fullmetalslug/.agents/orchestrator/PROJECT.md
- /Users/user/src/fullmetalslug/.agents/spec_miner_survey_3/spec_report.md

Milestone: M5 — Web Audio API Sound Effects & Formant Speech Synthesizer.

File Write Ownership (Exclusively yours):
- src/audio/AudioTypes.ts
- src/audio/SoundEngine.ts
- src/audio/SpeechSynthesizer.ts

Specifications to implement:
1. Web Audio API Sound Engine (`SoundEngine.ts`):
   - Graceful AudioContext lifecycle (starts suspended, auto-resumes on first user interaction: click/keydown/touch).
   - Procedural synthesis routines using native Web Audio oscillators, noise buffers, and exponential gain ramps:
     - `playPistol()`: Sharp high-frequency transient + low-mid punch.
     - `playHeavyMachineGun()`: Rapid metallic snap + shell casing clatter.
     - `playFlameShot()`: White noise filtered whoosh + crackling low-end fire loop.
     - `playGrenadeLaunch()`: Thump pop sound.
     - `playGrenadeBounce()`: High-pitch metallic ping.
     - `playExplosion()`: Low-pass filtered noise blast with exponential decay and sub-bass rumble.
     - `playKnifeSlash()`: Swift high-pass filtered noise whoosh.
     - `playBulletHit()`: Metal ricochet or flesh impact punch.
     - `playItemPickup()`: Retro arcade ascending arpeggio.
2. Formant Speech Announcer Engine (`SpeechSynthesizer.ts`):
   - Source-Filter speech synthesizer using glottal pulse train and 4-band biquad bandpass formant filters (F1, F2, F3, F4) to synthesize iconic arcade voice clips:
     - `"HEAVY MACHINE GUN!"`
     - `"FLAME SHOT!"`
     - `"OK!"`
     - `"MISSION COMPLETE!"`
     - `"THANK YOU!"` (POW rescue)
   - Pre-render audio buffers on initialization to guarantee zero-latency playback during gameplay.

Verification:
- Run `npx tsc --noEmit` and confirm 0 errors.
- Run `npm run build` and confirm production bundle compiles cleanly.
- Write handoff report to /Users/user/src/fullmetalslug/.agents/worker_m5/handoff.md and notify orchestrator via send_message.
