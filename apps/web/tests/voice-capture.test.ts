import { afterEach, describe, expect, it, vi } from 'vitest';
import { startVoiceCapture } from '../src/features/reviews/voiceCapture';

afterEach(() => {
  Reflect.deleteProperty(navigator, 'maxTouchPoints');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('voiceCapture', () => {
  it('falls back to a WAV file when MediaRecorder returns no chunks but the microphone has signal', async () => {
    const stopTrack = vi.fn();
    const processors = stubAudioContext();
    stubMicrophone({ getTracks: () => [{ stop: stopTrack }] });
    class EmptyRecorder {
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onstop: (() => void) | null = null;
      mimeType = 'audio/mp4';
      state = 'recording';
      start() {}
      requestData() {}
      stop() {
        this.state = 'inactive';
        this.onstop?.();
      }
    }
    vi.stubGlobal('MediaRecorder', EmptyRecorder);
    const onLevel = vi.fn();

    const session = await startVoiceCapture(onLevel);
    emitAudio(processors[0], [0.12, 0.1, -0.1, -0.12]);
    const result = await session.stop();

    expect(result.source).toBe('wav-fallback');
    expect(result.hadSignal).toBe(true);
    expect(result.file).toEqual(expect.objectContaining({
      name: 'voice-note.wav',
      type: 'audio/wav'
    }));
    expect(result.file?.size).toBeGreaterThan(44);
    expect(onLevel).toHaveBeenCalledWith(expect.any(Number), true);
    expect(stopTrack).toHaveBeenCalledTimes(1);
  });

  it('can capture WAV evidence when MediaRecorder is unavailable', async () => {
    const processors = stubAudioContext();
    stubMicrophone({ getTracks: () => [] });
    vi.stubGlobal('MediaRecorder', undefined);

    const session = await startVoiceCapture(vi.fn());
    emitAudio(processors[0], [0.08, -0.08, 0.07, -0.07]);
    const result = await session.stop();

    expect(result.source).toBe('wav-fallback');
    expect(result.file?.name).toBe('voice-note.wav');
    expect(result.file?.type).toBe('audio/wav');
  });

  it('uses the WAV fallback when MediaRecorder construction fails', async () => {
    const processors = stubAudioContext();
    stubMicrophone({ getTracks: () => [] });
    vi.stubGlobal('MediaRecorder', class BrokenRecorder {
      constructor() {
        throw new Error('recorder unavailable');
      }
    });

    const session = await startVoiceCapture(vi.fn());
    emitAudio(processors[0], [0.2, -0.2, 0.18, -0.18]);
    const result = await session.stop();

    expect(result.source).toBe('wav-fallback');
    expect(result.file?.type).toBe('audio/wav');
  });

  it('falls back when MediaRecorder rejects a timesliced start', async () => {
    stubMicrophone({ getTracks: () => [] });
    const startCalls: Array<number | undefined> = [];
    class TimesliceRejectingRecorder {
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onstop: (() => void) | null = null;
      mimeType = 'audio/webm';
      state = 'recording';
      start(timeslice?: number) {
        startCalls.push(timeslice);
        if (timeslice) throw new Error('timeslice rejected');
        this.ondataavailable?.({ data: new Blob(['voice'], { type: 'audio/webm' }) } as BlobEvent);
      }
      requestData() {}
      stop() {
        this.state = 'inactive';
        this.onstop?.();
      }
    }
    vi.stubGlobal('MediaRecorder', TimesliceRejectingRecorder);

    const session = await startVoiceCapture(vi.fn());
    const result = await session.stop();

    expect(startCalls).toEqual([1000, undefined]);
    expect(result.source).toBe('media-recorder');
    expect(result.file?.name).toBe('voice-note.webm');
  });

  it('still returns recorder audio when stop throws after data was captured', async () => {
    stubMicrophone({ getTracks: () => [] });
    class StopThrowingRecorder {
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onstop: (() => void) | null = null;
      mimeType = 'audio/webm';
      state = 'recording';
      start() {
        this.ondataavailable?.({ data: new Blob(['voice'], { type: 'audio/webm' }) } as BlobEvent);
      }
      requestData() {}
      stop() {
        throw new Error('stop failed');
      }
    }
    vi.stubGlobal('MediaRecorder', StopThrowingRecorder);

    const session = await startVoiceCapture(vi.fn());
    const result = await session.stop();

    expect(result.source).toBe('media-recorder');
    expect(result.file?.type).toBe('audio/webm');
  });

  it('returns no file when microphone access succeeds but no input signal is present', async () => {
    const processors = stubAudioContext();
    stubMicrophone({ getTracks: () => [] });
    vi.stubGlobal('MediaRecorder', undefined);

    const session = await startVoiceCapture(vi.fn());
    emitAudio(processors[0], [0, 0, 0, 0]);
    const result = await session.stop();

    expect(result.source).toBe('none');
    expect(result.hadSignal).toBe(false);
    expect(result.file).toBeNull();
  });

  it('stops microphone tracks when capture setup fails after permission is granted', async () => {
    const stopTrack = vi.fn();
    stubMicrophone({ getTracks: () => [{ stop: stopTrack }] });
    class BrokenAudioContext {
      constructor() {
        throw new Error('audio context failed');
      }
    }
    vi.stubGlobal('AudioContext', BrokenAudioContext);
    vi.stubGlobal('MediaRecorder', undefined);

    await expect(startVoiceCapture(vi.fn())).rejects.toThrow('audio context failed');
    expect(stopTrack).toHaveBeenCalledTimes(1);
  });
});

type FakeProcessor = {
  onaudioprocess: ((event: AudioProcessingEvent) => void) | null;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};

function stubAudioContext(state = 'running') {
  const processors: FakeProcessor[] = [];
  class FakeAudioContext {
    sampleRate = 8000;
    state = state;
    destination = {};
    createMediaStreamSource() {
      return { connect: vi.fn(), disconnect: vi.fn() };
    }
    createScriptProcessor() {
      const processor = { onaudioprocess: null, connect: vi.fn(), disconnect: vi.fn() };
      processors.push(processor);
      return processor;
    }
    resume() {
      return Promise.resolve();
    }
    close() {
      return Promise.resolve();
    }
  }
  vi.stubGlobal('AudioContext', FakeAudioContext);
  return processors;
}

function emitAudio(processor: FakeProcessor, samples: number[]) {
  const output = new Float32Array(samples.length);
  processor.onaudioprocess?.({
    inputBuffer: { getChannelData: () => new Float32Array(samples) },
    outputBuffer: { getChannelData: () => output }
  } as unknown as AudioProcessingEvent);
}

function stubMicrophone(stream: { getTracks: () => Array<{ stop?: () => void }> }) {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue(stream) }
  });
}
