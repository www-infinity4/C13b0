/**
 * Cartoon Prompt Engine — Audio Engine: Voice Synthesizer Interface
 *
 * Typed interface layer for voice cloning and synthesis services.
 *
 * This module defines the data contracts for voice generation.  Actual
 * audio synthesis is performed by an external service (ElevenLabs, Fish
 * Speech, Coqui TTS, or a local model via Ollama).  The interface is
 * service-agnostic: swap the adapter without changing any call-site code.
 *
 * Emotional state mapping:
 *   The AnimationMood produced by ChordAnalyzer drives the voice inflection.
 *   A minor-key performance → "concerned" or "fearful" voice parameters.
 *   A major-key performance → "confident" or "heroic" voice parameters.
 *
 * Usage (with an ElevenLabs adapter):
 *   import { VoiceSynthesizer, GADGET_VOICE_PROFILE } from './voice';
 *   import { ElevenLabsAdapter } from './adapters/elevenlabs';
 *
 *   const synth  = new VoiceSynthesizer(new ElevenLabsAdapter(apiKey));
 *   const result = await synth.synthesize({
 *     text:          "Don't worry — Gadget's on the case!",
 *     voice_profile: GADGET_VOICE_PROFILE,
 *     emotional_state: { valence: 0.8, arousal: 0.9, label: 'heroic' },
 *   });
 *   // result.audio_url → signed URL to the generated audio file
 *
 * AudioAssembler (scaffold):
 *   The AudioAssembler interface describes the contract for mixing voice,
 *   music, and foley into a final audio track using an external tool such
 *   as FFmpeg.  A concrete implementation requires the `ffmpeg` binary;
 *   see the README for installation instructions.
 */

// ---------------------------------------------------------------------------
// Emotional state
// ---------------------------------------------------------------------------

/**
 * EmotionalState — the affective parameters driving voice inflection.
 *
 * valence  : −1.0 (most negative) to +1.0 (most positive)
 * arousal  : 0.0 (calm) to 1.0 (highly energised)
 * label    : human-readable label for logging and debugging
 *
 * Map from ChordAnalyzer.analyze().sentiment_score:
 *   score ≥  0.6  → valence=+1.0  arousal=0.9  label='heroic'
 *   score ≥  0.2  → valence=+0.5  arousal=0.6  label='confident'
 *   score ≥ -0.2  → valence= 0.0  arousal=0.4  label='neutral'
 *   score ≥ -0.6  → valence=−0.5  arousal=0.5  label='concerned'
 *   score <  -0.6 → valence=−1.0  arousal=0.8  label='fearful'
 */
export interface EmotionalState {
  valence: number;
  arousal: number;
  label: string;
}

/**
 * sentimentToEmotionalState
 *
 * Converts a ChordAnalyzer sentiment score (−1.0 to +1.0) to an EmotionalState.
 * Use this to wire the MIDI chord analysis directly into voice synthesis.
 */
export function sentimentToEmotionalState(sentimentScore: number): EmotionalState {
  if (sentimentScore >= 0.6)  return { valence:  1.0, arousal: 0.9, label: 'heroic'     };
  if (sentimentScore >= 0.2)  return { valence:  0.5, arousal: 0.6, label: 'confident'  };
  if (sentimentScore >= -0.2) return { valence:  0.0, arousal: 0.4, label: 'neutral'    };
  if (sentimentScore >= -0.6) return { valence: -0.5, arousal: 0.5, label: 'concerned'  };
  return                             { valence: -1.0, arousal: 0.8, label: 'fearful'    };
}

// ---------------------------------------------------------------------------
// Voice profiles
// ---------------------------------------------------------------------------

/**
 * VoiceProfile — the immutable characteristics of a cloned voice.
 *
 * voice_id is service-specific:
 *   ElevenLabs: the 20-character voice ID from the Voices API
 *   Fish Speech: the model checkpoint path
 *   Coqui:      the speaker embedding name
 */
export interface VoiceProfile {
  /** Unique identifier for this voice profile. */
  id: string;
  /** Character this profile belongs to. */
  character_id: string;
  /** Display name. */
  name: string;
  /** Service-specific voice ID (ElevenLabs, Fish Speech, Coqui, etc.). */
  voice_id: string;
  /** Base stability (0.0–1.0): higher = more consistent, less expressive. */
  stability: number;
  /** Similarity boost (0.0–1.0): how closely to match the cloned voice. */
  similarity_boost: number;
  /** Speaking style intensity (0.0–1.0): accent / mannerism strength. */
  style: number;
  /** Use speaker boost for low-quality source recordings. */
  use_speaker_boost: boolean;
}

/**
 * GADGET_VOICE_PROFILE
 *
 * Default voice profile for Investor Gadget: a raspy, precise, slightly
 * mechanical detective voice.  The voice_id is a placeholder — replace
 * with the actual cloned voice ID from your synthesis service.
 */
export const GADGET_VOICE_PROFILE: VoiceProfile = {
  id:                'gadget_v1',
  character_id:      'investor_gadget',
  name:              'Investor Gadget — Cloned Voice v1',
  voice_id:          'PLACEHOLDER_REPLACE_WITH_ACTUAL_VOICE_ID',
  stability:         0.65,
  similarity_boost:  0.80,
  style:             0.45,
  use_speaker_boost: true,
};

/**
 * MOUSE_VOICE_PROFILE
 *
 * Default voice profile for the mouse character: high-pitched, excitable,
 * slightly nasal cartoon voice.
 */
export const MOUSE_VOICE_PROFILE: VoiceProfile = {
  id:                'mouse_v1',
  character_id:      'mouse_01',
  name:              'Mouse — Cartoon Voice v1',
  voice_id:          'PLACEHOLDER_REPLACE_WITH_ACTUAL_VOICE_ID',
  stability:         0.70,
  similarity_boost:  0.75,
  style:             0.60,
  use_speaker_boost: false,
};

// ---------------------------------------------------------------------------
// Synthesis request / response
// ---------------------------------------------------------------------------

/** Supported audio output formats. */
export type AudioFormat = 'mp3_44100_128' | 'pcm_16000' | 'wav_44100' | 'ogg_vorbis';

export interface SynthesisRequest {
  /** The dialogue text to synthesise. */
  text: string;
  voice_profile: VoiceProfile;
  emotional_state: EmotionalState;
  /** Output audio format. Default: 'mp3_44100_128'. */
  output_format?: AudioFormat;
  /** Target shot ID — used for file naming and sync reference. */
  shot_id?: string;
  /** Target tile ID — used for file naming. */
  tile_id?: string;
}

export interface SynthesisResult {
  /** Signed URL or local file path to the generated audio. */
  audio_url: string;
  /** Duration of the generated audio in seconds. */
  duration_s: number;
  /** Detected speaking rate (words per minute) for sync calculations. */
  words_per_minute: number;
  /** The emotional state that was applied. */
  emotional_state: EmotionalState;
  /** The voice profile used. */
  voice_profile: VoiceProfile;
  /** ISO timestamp of generation. */
  generated_at: string;
}

// ---------------------------------------------------------------------------
// Adapter interface (implemented by each service connector)
// ---------------------------------------------------------------------------

/**
 * VoiceSynthesisAdapter
 *
 * The interface that every synthesis service adapter must implement.
 * Swap adapters to change providers without modifying call-site code.
 */
export interface VoiceSynthesisAdapter {
  readonly serviceName: string;
  synthesize(request: SynthesisRequest): Promise<SynthesisResult>;
}

// ---------------------------------------------------------------------------
// VoiceSynthesizer — the main facade
// ---------------------------------------------------------------------------

/**
 * VoiceSynthesizer
 *
 * Facade over any VoiceSynthesisAdapter.  Applies emotional state to the
 * voice profile parameters before forwarding the request to the adapter.
 *
 * A concrete adapter (ElevenLabsAdapter, CoquiAdapter, etc.) must be
 * provided at construction time.
 */
export class VoiceSynthesizer {
  private readonly adapter: VoiceSynthesisAdapter;

  constructor(adapter: VoiceSynthesisAdapter) {
    this.adapter = adapter;
  }

  get serviceName(): string {
    return this.adapter.serviceName;
  }

  /**
   * synthesize
   *
   * Forwards the synthesis request to the configured adapter after
   * clamping emotional state parameters to valid ranges.
   */
  async synthesize(request: SynthesisRequest): Promise<SynthesisResult> {
    const clamped: SynthesisRequest = {
      ...request,
      output_format: request.output_format ?? 'mp3_44100_128',
      emotional_state: {
        valence: Math.max(-1, Math.min(1, request.emotional_state.valence)),
        arousal: Math.max(0,  Math.min(1, request.emotional_state.arousal)),
        label:   request.emotional_state.label,
      },
    };
    return this.adapter.synthesize(clamped);
  }
}

// ---------------------------------------------------------------------------
// AudioAssembler scaffold
// ---------------------------------------------------------------------------

/** dB level for a single audio track in the final mix. */
export interface TrackLevel {
  /** Path to the audio file. */
  file_path: string;
  /** Level in dBFS (e.g. -12 for background music, 0 for dialogue). */
  level_db: number;
  /** Frame offset at which this track starts (relative to tile start). */
  start_frame: number;
  fps: number;
}

export interface AssemblyOptions {
  /** Output file path for the mixed audio/video file. */
  output_path: string;
  /** Path to the video tile (silent, from the image generator). */
  video_path: string;
  /** Dialogue track (voice synthesis output). */
  dialogue: TrackLevel;
  /** Background score track (from MotifMapper MIDI output). */
  score: TrackLevel;
  /** Foley / SFX track (from external foley generator). */
  foley?: TrackLevel;
  /** Output frame rate. Default: 24. */
  fps?: number;
}

/**
 * AudioAssembler
 *
 * Interface for the final assembly step that merges video + voice + score
 * + foley into a single deliverable file.
 *
 * A concrete implementation (FFmpegAssembler) requires the `ffmpeg` binary
 * on the system PATH.  This interface exists so downstream code can be
 * written against it today, even without FFmpeg installed.
 *
 * Default mix levels (industry standard for broadcast animation):
 *   Dialogue : 0 dB   (always intelligible)
 *   Score    : −12 dB (background, never competes with voice)
 *   Foley    : −6 dB  (present but not distracting)
 */
export interface AudioAssembler {
  assemble(options: AssemblyOptions): Promise<{ output_path: string; duration_s: number }>;
}

/**
 * DEFAULT_MIX_LEVELS
 *
 * Industry-standard broadcast mix levels for animation.
 * Pass these to AssemblyOptions when building the final asset.
 */
export const DEFAULT_MIX_LEVELS = {
  DIALOGUE_DB:  0,
  SCORE_DB:    -12,
  FOLEY_DB:    -6,
} as const;
