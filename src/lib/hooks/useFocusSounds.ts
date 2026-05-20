"use client";

import { useCallback, useRef } from "react";

/**
 * Web Audio API-based Focus Soundscape Engine
 *
 * Generates procedural audio cues for focus flow transitions.
 * Zero dependencies, pure mathematical synthesis.
 */

type SoundType =
  | "focusStart"
  | "sessionComplete"
  | "breakEnd"
  | "sessionWarning"
  | "breakWarning";

interface Note {
  frequency: number;
  duration: number;
  delay?: number;
}

export function useFocusSounds() {
  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      )();
    }
    return audioContextRef.current;
  }, []);

  const playNote = useCallback(
    (
      frequency: number,
      duration: number,
      delay: number = 0,
      type: OscillatorType = "sine",
    ) => {
      const ctx = getAudioContext();
      const now = ctx.currentTime + delay;

      // Oscillator
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, now);

      // Gain envelope (ADSR)
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.05); // Attack
      gain.gain.linearRampToValueAtTime(0.1, now + 0.1); // Decay
      gain.gain.setValueAtTime(0.1, now + duration - 0.15); // Sustain
      gain.gain.linearRampToValueAtTime(0, now + duration); // Release

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    },
    [getAudioContext],
  );

  const playChord = useCallback(
    (notes: Note[], type: OscillatorType = "sine") => {
      notes.forEach((note) => {
        playNote(note.frequency, note.duration, note.delay || 0, type);
      });
    },
    [playNote],
  );

  const play = useCallback(
    (soundType: SoundType) => {
      switch (soundType) {
        case "focusStart":
          // Soft, rising major triad (C4 -> E4 -> G4)
          playChord([
            { frequency: 261.63, duration: 0.6, delay: 0 }, // C4
            { frequency: 329.63, duration: 0.6, delay: 0.15 }, // E4
            { frequency: 392.0, duration: 0.8, delay: 0.3 }, // G4
          ]);
          break;

        case "sessionComplete":
          // Bright, resolving Cmaj7 chord (C5 + E5 + G5 + B5)
          playChord(
            [
              { frequency: 523.25, duration: 1.2, delay: 0 }, // C5
              { frequency: 659.25, duration: 1.2, delay: 0.05 }, // E5
              { frequency: 783.99, duration: 1.2, delay: 0.1 }, // G5
              { frequency: 987.77, duration: 1.4, delay: 0.15 }, // B5
            ],
            "triangle", // Warmer tone for reward
          );
          break;

        case "breakEnd":
          // Gentle, repeating two-note motif (A4 -> C5)
          playChord([
            { frequency: 440.0, duration: 0.3, delay: 0 }, // A4
            { frequency: 523.25, duration: 0.4, delay: 0.25 }, // C5
            { frequency: 440.0, duration: 0.3, delay: 0.6 }, // A4 (repeat)
            { frequency: 523.25, duration: 0.5, delay: 0.85 }, // C5 (repeat)
          ]);
          break;

        case "sessionWarning":
          // Gentle descending dyad (G4 -> E4) - 1 minute warning
          playChord([
            { frequency: 392.0, duration: 0.4, delay: 0 }, // G4
            { frequency: 329.63, duration: 0.5, delay: 0.3 }, // E4
          ]);
          break;

        case "breakWarning":
          // Soft ascending reminder (E4 -> G4)
          playChord([
            { frequency: 329.63, duration: 0.4, delay: 0 }, // E4
            { frequency: 392.0, duration: 0.5, delay: 0.3 }, // G4
          ]);
          break;
      }
    },
    [playChord],
  );

  return { play };
}
