"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, X } from "lucide-react";

type SingerMode = "phi" | "pi" | "ping-pong";
type AudioWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

const PHI_DIGITS = "1618033988749894848204586834365638117720";
const PI_DIGITS = "3141592653589793238462643383279502884197";
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];

const modeNames: Record<SingerMode, string> = {
  phi: "Phi",
  pi: "Pi",
  "ping-pong": "Phi ↔ Pi",
};

function frequency(digit: string, root: number) {
  const step = SCALE[Number(digit) || 0];
  return root * Math.pow(2, step / 12);
}

export default function PhiSinger() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<SingerMode>("phi");
  const [playing, setPlaying] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);
  const contextRef = useRef<AudioContext | null>(null);
  const voicesRef = useRef<OscillatorNode[]>([]);
  const timersRef = useRef<number[]>([]);

  function stop() {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
    voicesRef.current.forEach((voice) => { try { voice.stop(); } catch {} });
    voicesRef.current = [];
    setPlaying(false);
    setActiveStep(-1);
  }

  function audioContext() {
    const AudioContextConstructor = window.AudioContext || (window as AudioWindow).webkitAudioContext;
    if (!AudioContextConstructor) return null;
    if (!contextRef.current || contextRef.current.state === "closed") contextRef.current = new AudioContextConstructor();
    if (contextRef.current.state === "suspended") void contextRef.current.resume();
    return contextRef.current;
  }

  function scheduleVoice(ctx: AudioContext, digit: string, start: number, root: number, pan: number, timbre: OscillatorType) {
    const oscillator = ctx.createOscillator();
    const overtone = ctx.createOscillator();
    const overtoneGain = ctx.createGain();
    const envelope = ctx.createGain();
    const panner = typeof ctx.createStereoPanner === "function" ? ctx.createStereoPanner() : null;
    const destination: AudioNode = panner || ctx.destination;
    const note = frequency(digit, root);

    oscillator.type = timbre;
    oscillator.frequency.setValueAtTime(note, start);
    overtone.type = "sine";
    overtone.frequency.setValueAtTime(note * 2, start);
    overtoneGain.gain.setValueAtTime(0.09, start);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(0.18, start + 0.018);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + 0.34);
    if (panner) {
      panner.pan.setValueAtTime(pan, start);
      panner.connect(ctx.destination);
    }
    oscillator.connect(envelope);
    overtone.connect(overtoneGain);
    overtoneGain.connect(envelope);
    envelope.connect(destination);
    oscillator.start(start);
    overtone.start(start);
    oscillator.stop(start + 0.36);
    overtone.stop(start + 0.36);
    voicesRef.current.push(oscillator, overtone);
  }

  function play(nextMode: SingerMode = mode) {
    stop();
    const ctx = audioContext();
    if (!ctx) return;
    setMode(nextMode);
    setPlaying(true);
    const length = 24;
    const interval = 0.225;
    const start = ctx.currentTime + 0.04;

    for (let index = 0; index < length; index += 1) {
      if (nextMode === "phi") {
        scheduleVoice(ctx, PHI_DIGITS[index], start + index * interval, 220, 0, "triangle");
      } else if (nextMode === "pi") {
        scheduleVoice(ctx, PI_DIGITS[index], start + index * interval, 261.63, 0, "sine");
      } else {
        const phiTurn = index % 2 === 0;
        const digitIndex = Math.floor(index / 2);
        scheduleVoice(ctx, phiTurn ? PHI_DIGITS[digitIndex] : PI_DIGITS[digitIndex], start + index * interval, phiTurn ? 220 : 261.63, phiTurn ? -0.72 : 0.72, phiTurn ? "triangle" : "sine");
      }
      timersRef.current.push(window.setTimeout(() => setActiveStep(index), index * interval * 1000));
    }
    timersRef.current.push(window.setTimeout(stop, (length * interval + 0.5) * 1000));
  }

  function openSinger() {
    setOpen(true);
    play("phi");
  }

  useEffect(() => () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    voicesRef.current.forEach((voice) => { try { voice.stop(); } catch {} });
    if (contextRef.current) void contextRef.current.close();
  }, []);

  const shownDigits = mode === "pi" ? PI_DIGITS : mode === "phi" ? PHI_DIGITS : PHI_DIGITS.slice(0, 12).split("").map((digit, index) => `${digit}${PI_DIGITS[index]}`).join("");

  return <>
    <button type="button" className="phi-singer-trigger" onClick={openSinger} aria-label="Open Phi Singer and play Phi">φ</button>
    {open && <section className="phi-singer" role="dialog" aria-modal="true" aria-label="Phi and Pi Singer">
      <header><div><small>Hidden instrument</small><b>{modeNames[mode]} Singer</b></div><button type="button" onClick={() => { stop(); setOpen(false); }} aria-label="Close singer"><X size={20}/></button></header>
      <div className="phi-singer-modes" role="group" aria-label="Singer mode">
        {(["phi", "pi", "ping-pong"] as SingerMode[]).map((item) => <button type="button" key={item} className={mode === item ? "active" : ""} onClick={() => play(item)}>{modeNames[item]}</button>)}
      </div>
      <div className="phi-singer-display" aria-live="polite">
        <span>{mode === "pi" ? "π" : mode === "phi" ? "φ" : "φ ↔ π"}</span>
        <div>{shownDigits.slice(0, 24).split("").map((digit, index) => <i key={`${digit}-${index}`} className={activeStep === index ? "active" : ""}>{digit}</i>)}</div>
      </div>
      <p>Each digit selects a musical scale step. Phi uses a warm triangular voice, Pi uses a clear sine voice, and ping-pong alternates them left and right.</p>
      <button type="button" className="phi-singer-play" onClick={() => playing ? stop() : play(mode)}>{playing ? <Pause size={18}/> : <Play size={18}/>} {playing ? "Stop" : `Play ${modeNames[mode]}`}</button>
    </section>}
  </>;
}
