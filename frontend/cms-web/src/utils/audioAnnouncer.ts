export function extractMrnNumber(mrn?: string | null, fallbackId?: string | number | null): string {
  if (!mrn && fallbackId) return String(fallbackId);
  if (!mrn) return '';
  const digits = String(mrn).replace(/\D/g, '');
  return digits || String(fallbackId || '');
}

// Shared Web Audio context
let _audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!_audioCtx || _audioCtx.state === 'closed') {
      _audioCtx = new AudioCtx();
    }
    if (_audioCtx.state === 'suspended') {
      _audioCtx.resume().catch(() => {});
    }
    return _audioCtx;
  } catch {
    return null;
  }
}

export function playTicketChimeAndSpeech(mrnNumber: string, counterName: string, patientName?: string) {
  const cleanedNumber = extractMrnNumber(mrnNumber);
  const destinationRoom = counterName || 'the assigned room';
  console.log(`[Queue Announcer] Summoning card #${cleanedNumber} to ${destinationRoom}`);

  // 1. Crystal Harmonic "Dew Ring" Bell Chime via Web Audio API
  try {
    const ctx = getAudioContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const playDewTone = (freq: number, harmonicFreq: number, startSec: number, duration: number, vol = 0.28) => {
        const osc = ctx.createOscillator();
        const harm = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startSec);

        harm.type = 'sine';
        harm.frequency.setValueAtTime(harmonicFreq, ctx.currentTime + startSec);

        gain.gain.setValueAtTime(0, ctx.currentTime + startSec);
        gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + startSec + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startSec + duration);

        osc.connect(gain);
        harm.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + startSec);
        harm.start(ctx.currentTime + startSec);
        osc.stop(ctx.currentTime + startSec + duration);
        harm.stop(ctx.currentTime + startSec + duration);
      };

      // 3-Stage gentle Dew Bell Chime: E5 -> G5 -> C6
      playDewTone(659.25, 1318.5, 0.0, 0.45, 0.25);  // E5
      playDewTone(783.99, 1567.98, 0.18, 0.50, 0.22); // G5
      playDewTone(1046.50, 2093.0, 0.38, 0.65, 0.28); // C6
    }
  } catch (err) {
    console.warn('[Queue Announcer] Audio chime failed:', err);
  }

  // 2. Speech Synthesis Announcer: "Card number XXX, please proceed to Room XXX"
  if ('speechSynthesis' in window) {
    try {
      // Workaround for Chrome speech synthesis bug where it gets stuck in paused state
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      window.speechSynthesis.cancel(); // Cancel any prior pending speech

      const spokenDigits = cleanedNumber.split('').join(' ');
      const message = `Card number ${spokenDigits}. Please proceed to ${destinationRoom}.`;

      const speakNow = () => {
        try {
          const utterance = new SpeechSynthesisUtterance(message);
          utterance.rate = 0.88;
          utterance.pitch = 1.05;
          utterance.volume = 1.0;
          utterance.lang = 'en-US';

          const voices = window.speechSynthesis.getVoices();
          if (voices.length > 0) {
            const naturalVoice =
              voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Female'))) ||
              voices.find(v => v.lang.startsWith('en'));
            if (naturalVoice) utterance.voice = naturalVoice;
          }

          utterance.onstart = () => console.log('[Queue Announcer] Speech started:', message);
          utterance.onerror = (e) => console.warn('[Queue Announcer] Speech error:', e);

          window.speechSynthesis.speak(utterance);
        } catch (e) {
          console.warn('[Queue Announcer] Speech execution error:', e);
        }
      };

      // Allow 600ms for the dew chime to ring first
      setTimeout(() => {
        if (window.speechSynthesis.getVoices().length > 0) {
          speakNow();
        } else {
          window.speechSynthesis.onvoiceschanged = () => {
            window.speechSynthesis.onvoiceschanged = null;
            speakNow();
          };
          setTimeout(speakNow, 500);
        }
      }, 600);
    } catch (err) {
      console.warn('[Queue Announcer] Speech synthesis error:', err);
    }
  }
}

export function playNotificationTone() {
  try {
    const ctx = getAudioContext();
    if (ctx) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880.0, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch {}
}
