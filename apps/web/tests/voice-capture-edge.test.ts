import { afterEach, describe, expect, it, vi } from 'vitest';
import { startVoiceCapture } from '../src/features/reviews/voiceCapture';

afterEach(() => {
  Reflect.deleteProperty(navigator, 'maxTouchPoints');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('voiceCapture edge cases', () => {
  it('prefers mp4 recording on iPhone when multiple MIME types are supported', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)');
    stubMicrophone({ getTracks: () => [] });
    const selectedTypes: Array<string | undefined> = [];
    class IPhoneRecorder {
      static isTypeSupported() {
        return true;
      }
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onstop: (() => void) | null = null;
      mimeType = 'audio/mp4';
      state = 'recording';
      constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
        selectedTypes.push(options?.mimeType);
      }
      start() {
        this.ondataavailable?.({ data: new Blob(['voice'], { type: 'audio/mp4' }) } as BlobEvent);
      }
      requestData() {}
      stop() {
        this.state = 'inactive';
        this.onstop?.();
      }
    }
    vi.stubGlobal('MediaRecorder', IPhoneRecorder);

    const session = await startVoiceCapture(vi.fn());
    const result = await session.stop();

    expect(selectedTypes[0]).toBe('audio/mp4;codecs=mp4a.40.2');
    expect(result.file?.name).toBe('voice-note.m4a');
  });

  it('prefers mp4 recording for touch iPads that identify as MacIntel', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)');
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });
    stubMicrophone({ getTracks: () => [] });
    const selectedTypes: Array<string | undefined> = [];
    class TouchIpadRecorder {
      static isTypeSupported() {
        return true;
      }
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onstop: (() => void) | null = null;
      mimeType = 'audio/mp4';
      state = 'recording';
      constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
        selectedTypes.push(options?.mimeType);
      }
      start() {
        this.ondataavailable?.({ data: new Blob(['voice'], { type: 'audio/mp4' }) } as BlobEvent);
      }
      stop() {
        this.state = 'inactive';
        this.onstop?.();
      }
    }
    vi.stubGlobal('MediaRecorder', TouchIpadRecorder);

    const session = await startVoiceCapture(vi.fn());
    await session.stop();

    expect(selectedTypes[0]).toBe('audio/mp4;codecs=mp4a.40.2');
  });

  it('returns captured data from a recorder that is already inactive on stop', async () => {
    stubMicrophone({ getTracks: () => [] });
    class InactiveRecorder {
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onstop: (() => void) | null = null;
      mimeType = 'audio/webm';
      state = 'inactive';
      start() {
        this.ondataavailable?.({ data: new Blob(['voice'], { type: 'audio/webm' }) } as BlobEvent);
      }
    }
    vi.stubGlobal('MediaRecorder', InactiveRecorder);

    const session = await startVoiceCapture(vi.fn());
    const result = await session.stop();

    expect(result.source).toBe('media-recorder');
    expect(result.file?.type).toBe('audio/webm');
  });

  it('uses a safe webm filename when the recorder reports no MIME type', async () => {
    stubMicrophone({ getTracks: () => [] });
    class BlankMimeRecorder {
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onstop: (() => void) | null = null;
      mimeType = '';
      state = 'recording';
      start() {
        this.ondataavailable?.({ data: new Blob(['voice']) } as BlobEvent);
      }
      stop() {
        this.state = 'inactive';
        this.onstop?.();
      }
    }
    vi.stubGlobal('MediaRecorder', BlankMimeRecorder);

    const session = await startVoiceCapture(vi.fn());
    const result = await session.stop();

    expect(result.file?.name).toBe('voice-note.webm');
    expect(result.file?.type).toBe('audio/webm');
  });

  it('names mpeg recorder output as mp3', async () => {
    stubMicrophone({ getTracks: () => [] });
    class MpegRecorder {
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onstop: (() => void) | null = null;
      mimeType = 'audio/mpeg';
      state = 'recording';
      start() {
        this.ondataavailable?.({ data: new Blob(['voice'], { type: 'audio/mpeg' }) } as BlobEvent);
      }
      stop() {
        this.state = 'inactive';
        this.onstop?.();
      }
    }
    vi.stubGlobal('MediaRecorder', MpegRecorder);

    const session = await startVoiceCapture(vi.fn());
    const result = await session.stop();

    expect(result.file?.name).toBe('voice-note.mp3');
    expect(result.file?.type).toBe('audio/mpeg');
  });

  it('preserves an existing recorder stop handler', async () => {
    stubMicrophone({ getTracks: () => [] });
    const existingStop = vi.fn();
    class ExistingStopRecorder {
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onstop: (() => void) | null = existingStop;
      mimeType = 'audio/webm';
      state = 'recording';
      start() {
        this.ondataavailable?.({ data: new Blob(['voice'], { type: 'audio/webm' }) } as BlobEvent);
      }
      stop() {
        this.state = 'inactive';
        this.onstop?.();
      }
    }
    vi.stubGlobal('MediaRecorder', ExistingStopRecorder);

    const session = await startVoiceCapture(vi.fn());
    await session.stop();

    expect(existingStop).toHaveBeenCalledTimes(1);
  });

  it('handles empty Web Audio buffers without treating them as input signal', async () => {
    const processors = stubAudioContext();
    stubMicrophone({ getTracks: () => [] });
    class RecorderWithData {
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onstop: (() => void) | null = null;
      mimeType = 'audio/webm';
      state = 'recording';
      start() {
        this.ondataavailable?.({ data: new Blob(['voice'], { type: 'audio/webm' }) } as BlobEvent);
      }
      stop() {
        this.state = 'inactive';
        this.onstop?.();
      }
    }
    vi.stubGlobal('MediaRecorder', RecorderWithData);
    const onLevel = vi.fn();

    const session = await startVoiceCapture(onLevel);
    emitAudio(processors[0], []);
    const result = await session.stop();

    expect(onLevel).toHaveBeenCalledWith(0, false);
    expect(result.source).toBe('media-recorder');
  });

  it('resumes a suspended audio context before monitoring input', async () => {
    const processors = stubAudioContext('suspended');
    stubMicrophone({ getTracks: () => [] });
    vi.stubGlobal('MediaRecorder', undefined);

    const session = await startVoiceCapture(vi.fn());
    emitAudio(processors[0], [0.1, -0.1]);
    const result = await session.stop();

    expect(result.source).toBe('wav-fallback');
  });

  it('fails closed when permission is granted but no capture method can be created', async () => {
    const stopTrack = vi.fn();
    stubMicrophone({ getTracks: () => [{ stop: stopTrack }] });
    class BrokenRecorder {
      constructor() {
        throw new Error('recorder constructor failed');
      }
    }
    vi.stubGlobal('MediaRecorder', BrokenRecorder);

    await expect(startVoiceCapture(vi.fn())).rejects.toThrow('Voice recording is not available');
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
