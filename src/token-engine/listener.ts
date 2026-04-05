/**
 * Token Engine — Input Listener  (browser-side, client component only)
 *
 * Maps physical keyboard and MIDI input to named animation scene triggers.
 * When a keystroke sequence or MIDI chord matches a registered pattern,
 * a SceneTrigger is delivered to your callback — ready to feed directly
 * into generateTileBlueprint() from the cartoon-engine.
 *
 * NOTE: This module uses browser-only APIs (KeyboardEvent, Web MIDI API).
 * Only import it inside a Next.js Client Component ('use client') or
 * after a typeof-window guard.
 *
 * Usage:
 *   const keys = new KeystrokeListener((trigger) => {
 *     console.log(trigger.scene, trigger.character_id);
 *   });
 *   keys.start();
 *   // …later…
 *   keys.stop();
 *
 *   const midi = new MidiListener((trigger) => { … });
 *   await midi.start();
 */

import { matchKeySequence, matchMidiChord } from './patterns';

// ---------------------------------------------------------------------------
// Minimal Web MIDI API type declarations (no @types/webmidi dependency)
// ---------------------------------------------------------------------------

interface MIDIMessageEvent extends Event {
  readonly data: Uint8Array;
}

interface MIDIPort extends EventTarget {
  readonly id: string;
  readonly type: 'input' | 'output';
  readonly state: 'connected' | 'disconnected';
}

interface MIDIInput extends MIDIPort {
  onmidimessage: ((e: MIDIMessageEvent) => void) | null;
}

interface MIDIConnectionEvent extends Event {
  readonly port: MIDIPort;
}

interface MIDIAccess extends EventTarget {
  readonly inputs: Map<string, MIDIInput>;
  onstatechange: ((e: MIDIConnectionEvent) => void) | null;
}

interface NavigatorWithMIDI {
  requestMIDIAccess(): Promise<MIDIAccess>;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Emitted when a keystroke sequence or MIDI chord matches a named pattern. */
export interface SceneTrigger {
  /** Pattern name from the registry (e.g. "rescue", "gadget_rescue_chord"). */
  pattern_name: string;
  /** Scene identifier to pass to generateTileBlueprint(). */
  scene: string;
  /** Character ID to use for the triggered scene. */
  character_id: string;
  /** Whether the trigger came from keyboard or MIDI. */
  source: 'keyboard' | 'midi';
  /**
   * The token sequence that produced this trigger.
   * Format: "KEY:<code>" for keystrokes, "MIDI:<note>" for MIDI notes.
   * These are stable, deterministic identifiers — not cryptographic hashes.
   */
  token_sequence: string[];
  /** Unix timestamp (ms) when the trigger fired. */
  timestamp: number;
}

export type TriggerCallback = (trigger: SceneTrigger) => void;

// ---------------------------------------------------------------------------
// Token ID helpers (deterministic, human-readable)
// ---------------------------------------------------------------------------

/** Stable token ID for a keyboard event code. */
function keystrokeToken(code: string): string {
  return `KEY:${code}`;
}

/** Stable token ID for a MIDI note number. */
function midiToken(note: number): string {
  return `MIDI:${note}`;
}

// ---------------------------------------------------------------------------
// KeystrokeListener
// ---------------------------------------------------------------------------

/**
 * KeystrokeListener
 *
 * Maintains a rolling buffer of KeyboardEvent.code values and checks each
 * new keystroke against the registered KEY_PATTERNS.  When a sequence tail
 * matches, a SceneTrigger is fired and the buffer is reset.
 *
 * Modifier keys (Ctrl, Alt, Meta, Shift) are ignored so they do not corrupt
 * the sequence when used for copy/paste etc.
 */
export class KeystrokeListener {
  private readonly sequence: string[] = [];
  private readonly maxLength: number;
  private readonly onTrigger: TriggerCallback;
  private running = false;

  constructor(onTrigger: TriggerCallback, maxLength = 20) {
    this.onTrigger = onTrigger;
    this.maxLength = maxLength;
  }

  /** Attach the keydown handler to the window. */
  start(): void {
    if (this.running) return;
    window.addEventListener('keydown', this.handleKeydown);
    this.running = true;
  }

  /** Detach the keydown handler. */
  stop(): void {
    window.removeEventListener('keydown', this.handleKeydown);
    this.running = false;
  }

  /** Clear the accumulated sequence without stopping the listener. */
  reset(): void {
    this.sequence.length = 0;
  }

  private readonly handleKeydown = (e: KeyboardEvent): void => {
    // Ignore standalone modifier keys
    if (['Meta', 'Control', 'Alt', 'Shift'].includes(e.key)) return;

    this.sequence.push(keystrokeToken(e.code));
    if (this.sequence.length > this.maxLength) {
      this.sequence.shift();
    }

    const match = matchKeySequence(
      this.sequence.map((t) => t.replace('KEY:', ''))
    );
    if (match) {
      this.onTrigger({
        pattern_name:    match.name,
        scene:           match.scene,
        character_id:    match.character_id,
        source:          'keyboard',
        token_sequence:  [...this.sequence],
        timestamp:       Date.now(),
      });
      this.reset();
    }
  };
}

// ---------------------------------------------------------------------------
// MidiListener
// ---------------------------------------------------------------------------

/**
 * MidiListener
 *
 * Uses the Web MIDI API to track which notes are currently held and checks
 * them against registered MIDI_CHORD_PATTERNS on every Note On event.
 * When a chord matches, a SceneTrigger is fired and the held-note set is
 * cleared.
 *
 * Falls back gracefully if the browser does not support the Web MIDI API
 * or the user denies permission.
 */
export class MidiListener {
  private readonly heldNotes = new Set<number>();
  private readonly onTrigger: TriggerCallback;
  private access: MIDIAccess | null = null;

  constructor(onTrigger: TriggerCallback) {
    this.onTrigger = onTrigger;
  }

  /**
   * Request MIDI access and begin listening on all available inputs.
   * Returns false if MIDI is unavailable or permission is denied.
   */
  async start(): Promise<boolean> {
    const nav = navigator as unknown as NavigatorWithMIDI;
    if (typeof nav.requestMIDIAccess !== 'function') {
      console.warn('[TokenEngine/MidiListener] Web MIDI API not available in this browser.');
      return false;
    }
    try {
      this.access = await nav.requestMIDIAccess();
      this.access.inputs.forEach((input) => this.attachInput(input));
      this.access.onstatechange = this.handleStateChange;
      return true;
    } catch (err) {
      console.warn('[TokenEngine/MidiListener] MIDI permission denied:', err);
      return false;
    }
  }

  /** Detach all MIDI handlers and clear the held-note set. */
  stop(): void {
    if (this.access) {
      this.access.inputs.forEach((input) => {
        input.onmidimessage = null;
      });
      this.access.onstatechange = null;
    }
    this.heldNotes.clear();
  }

  private attachInput(input: MIDIInput): void {
    input.onmidimessage = this.handleMidiMessage;
  }

  private readonly handleStateChange = (e: MIDIConnectionEvent): void => {
    if (e.port.type === 'input' && e.port.state === 'connected') {
      this.attachInput(e.port as MIDIInput);
    }
  };

  private readonly handleMidiMessage = (e: MIDIMessageEvent): void => {
    const [status, note, velocity] = e.data;
    const command = status & 0xf0;

    if (command === 0x90 && velocity > 0) {
      // Note On
      this.heldNotes.add(note);
      const match = matchMidiChord(Array.from(this.heldNotes));
      if (match) {
        this.onTrigger({
          pattern_name:   match.name,
          scene:          match.scene,
          character_id:   match.character_id,
          source:         'midi',
          token_sequence: Array.from(this.heldNotes).map(midiToken),
          timestamp:      Date.now(),
        });
        this.heldNotes.clear();
      }
    } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
      // Note Off
      this.heldNotes.delete(note);
    }
  };
}
