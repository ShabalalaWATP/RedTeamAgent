const RECORDING_TIMESLICE_MS = 1000;
const MIN_RECORDING_MS = 1200;
const FINAL_CHUNK_GRACE_MS = 150;
const STOP_EVENT_TIMEOUT_MS = 1200;
const INPUT_SIGNAL_THRESHOLD = 0.004;

type LevelHandler = (level: number, hasSignal: boolean) => void;

export type VoiceCaptureResult = {
  file: File | null;
  source: 'media-recorder' | 'wav-fallback' | 'none';
  hadSignal: boolean;
};

export type VoiceCaptureSession = {
  isActive: () => boolean;
  stop: () => Promise<VoiceCaptureResult>;
  dispose: () => void;
};

export async function startVoiceCapture(onLevel: LevelHandler): Promise<VoiceCaptureSession> {
  if (!supportsVoiceCapture()) throw new Error('Voice recording is not available in this browser. Upload an audio file instead.');
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  try {
    const monitor = await createMonitor(stream, onLevel);
    const recorder = createMediaRecorder(stream);
    if (!monitor && !recorder) throw new Error('Voice recording is not available in this browser. Upload an audio file instead.');
    return new BrowserVoiceCapture(stream, recorder, monitor);
  } catch (err) {
    stopTracks(stream);
    throw err;
  }
}

export function supportsVoiceCapture() {
  return typeof navigator !== 'undefined'
    && Boolean(navigator.mediaDevices?.getUserMedia)
    && (supportsMediaRecorder() || supportsAudioContext());
}

class BrowserVoiceCapture implements VoiceCaptureSession {
  private readonly startedAt = Date.now();
  private readonly chunks: Blob[] = [];
  private stopping: Promise<VoiceCaptureResult> | null = null;
  private stopped = false;

  constructor(
    private readonly stream: MediaStream,
    private readonly recorder: MediaRecorder | null,
    private readonly monitor: PcmMonitor | null
  ) {
    if (!recorder) return;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.chunks.push(event.data);
    };
    try {
      recorder.start(RECORDING_TIMESLICE_MS);
    } catch {
      recorder.start();
    }
  }

  isActive() {
    return !this.stopped && (!this.recorder || this.recorder.state !== 'inactive');
  }

  stop() {
    this.stopping ??= this.stopOnce();
    return this.stopping;
  }

  dispose() {
    this.monitor?.stop();
    stopTracks(this.stream);
  }

  private async stopOnce(): Promise<VoiceCaptureResult> {
    this.stopped = true;
    await this.waitForMinimumRecordingWindow();
    const mediaFile = await this.stopMediaRecorder();
    if (mediaFile) {
      this.dispose();
      return { file: mediaFile, source: 'media-recorder', hadSignal: this.monitor?.hasSignal() ?? true };
    }
    const fallback = this.monitor?.fallbackFile();
    this.dispose();
    if (fallback) return { file: fallback, source: 'wav-fallback', hadSignal: true };
    return { file: null, source: 'none', hadSignal: this.monitor?.hasSignal() ?? false };
  }

  private async waitForMinimumRecordingWindow() {
    const elapsed = Date.now() - this.startedAt;
    if (elapsed < MIN_RECORDING_MS && this.chunks.length === 0 && !this.monitor?.hasSignal()) {
      await delay(MIN_RECORDING_MS - elapsed);
    }
  }

  private stopMediaRecorder(): Promise<File | null> {
    const recorder = this.recorder;
    if (!recorder) return Promise.resolve(null);
    const mimeType = recorder.mimeType || preferredAudioMimeType() || 'audio/webm';
    if (recorder.state === 'inactive') return Promise.resolve(this.mediaRecorderFile(mimeType));
    return new Promise((resolve) => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        window.setTimeout(() => resolve(this.mediaRecorderFile(mimeType)), FINAL_CHUNK_GRACE_MS);
      };
      const previous = recorder.onstop;
      recorder.onstop = (event) => {
        previous?.call(recorder, event);
        finish();
      };
      window.setTimeout(finish, STOP_EVENT_TIMEOUT_MS);
      try {
        recorder.requestData?.();
        recorder.stop();
      } catch {
        finish();
      }
    });
  }

  private mediaRecorderFile(mimeType: string) {
    const captured = this.chunks.filter((chunk) => chunk.size > 0);
    if (captured.length === 0) return null;
    const capturedType = baseMimeType(mimeType);
    return new File(captured, voiceFilename(capturedType), { type: capturedType });
  }
}

class PcmMonitor {
  private signalDetected = false;
  private readonly chunks: Float32Array[] = [];

  constructor(
    private readonly context: AudioContext,
    private readonly source: MediaStreamAudioSourceNode,
    private readonly processor: ScriptProcessorNode,
    private readonly onLevel: LevelHandler
  ) {
    processor.onaudioprocess = (event) => this.handleAudio(event);
    source.connect(processor);
    processor.connect(context.destination);
  }

  hasSignal() {
    return this.signalDetected;
  }

  fallbackFile() {
    if (!this.signalDetected || this.chunks.length === 0) return null;
    const wav = encodeWav(this.chunks, this.context.sampleRate);
    return new File([wav], 'voice-note.wav', { type: 'audio/wav' });
  }

  stop() {
    this.processor.onaudioprocess = null;
    this.source.disconnect();
    this.processor.disconnect();
    void this.context.close();
  }

  private handleAudio(event: AudioProcessingEvent) {
    const input = event.inputBuffer.getChannelData(0);
    const copy = new Float32Array(input);
    this.chunks.push(copy);
    const level = rmsLevel(copy);
    if (level >= INPUT_SIGNAL_THRESHOLD) this.signalDetected = true;
    this.onLevel(Math.min(1, level * 16), this.signalDetected);
    event.outputBuffer.getChannelData(0).fill(0);
  }
}

async function createMonitor(stream: MediaStream, onLevel: LevelHandler) {
  const Context = audioContextConstructor();
  if (!Context) return null;
  const context = new Context();
  if (context.state === 'suspended') await context.resume();
  const source = context.createMediaStreamSource(stream);
  const processor = context.createScriptProcessor(4096, 1, 1);
  return new PcmMonitor(context, source, processor, onLevel);
}

function createMediaRecorder(stream: MediaStream) {
  if (!supportsMediaRecorder()) return null;
  const mimeType = preferredAudioMimeType();
  try {
    return mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  } catch {
    return null;
  }
}

function preferredAudioMimeType() {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return '';
  const appleTypes = ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];
  const defaultTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4'];
  for (const type of isAppleMobileBrowser() ? appleTypes : defaultTypes) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

function isAppleMobileBrowser() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function audioContextConstructor() {
  const candidate = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return candidate ?? null;
}

function supportsMediaRecorder() {
  return typeof MediaRecorder !== 'undefined';
}

function supportsAudioContext() {
  return audioContextConstructor() !== null;
}

function baseMimeType(value: string) {
  return value.split(';', 1)[0].trim().toLowerCase() || 'audio/webm';
}

function voiceFilename(mimeType: string) {
  if (mimeType === 'audio/mp4') return 'voice-note.m4a';
  if (mimeType === 'audio/mpeg') return 'voice-note.mp3';
  if (mimeType === 'audio/wav' || mimeType === 'audio/wave' || mimeType === 'audio/x-wav') return 'voice-note.wav';
  return 'voice-note.webm';
}

function stopTracks(stream: MediaStream) {
  stream.getTracks().forEach((track) => track.stop());
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function rmsLevel(samples: Float32Array) {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.sqrt(sum / samples.length);
}

function encodeWav(chunks: Float32Array[], sampleRate: number) {
  const sampleCount = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const buffer = new ArrayBuffer(44 + sampleCount * 2);
  const view = new DataView(buffer);
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + sampleCount * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, sampleCount * 2, true);
  let offset = 44;
  for (const chunk of chunks) {
    for (const sample of chunk) {
      const clipped = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff, true);
      offset += 2;
    }
  }
  return buffer;
}

function writeString(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
}
