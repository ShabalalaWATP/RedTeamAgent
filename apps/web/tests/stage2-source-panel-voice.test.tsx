import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SourceIntakePanel } from '../src/features/reviews/SourceIntakePanel';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Stage 2 voice source intake', () => {
  it('records audio with MediaRecorder and stops captured tracks', async () => {
    const user = userEvent.setup();
    const stopTrack = vi.fn();
    const onUpload = vi.fn().mockResolvedValue(undefined);
    const recorderInstances: FakeRecorder[] = [];
    class FakeRecorder {
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onstop: (() => void) | null = null;
      mimeType = 'audio/webm;codecs=opus';
      state = 'recording';
      constructor() {
        recorderInstances.push(this);
      }
      start() {
        this.ondataavailable?.({ data: new Blob(['voice'], { type: 'audio/webm' }) } as BlobEvent);
      }
      stop() {
        this.state = 'inactive';
        this.onstop?.();
      }
    }

    stubMicrophone({ getTracks: () => [{ stop: stopTrack }] });
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    renderSourcePanel({ onUpload });

    await user.click(screen.getByRole('button', { name: /record voice note/i }));
    expect(await screen.findByText('Microphone access granted. Waiting for voice input.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /stop and submit/i }));

    await waitFor(() => expect(onUpload).toHaveBeenCalledWith(expect.objectContaining({
      name: 'voice-note.webm',
      type: 'audio/webm'
    })));
    expect(recorderInstances).toHaveLength(1);
    expect(stopTrack).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/voice note submitted/i)).toBeInTheDocument();
  });

  it('shows live microphone input when the browser reports voice signal', async () => {
    const user = userEvent.setup();
    const processors = stubAudioContext();
    class FakeRecorder {
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onstop: (() => void) | null = null;
      mimeType = 'audio/webm';
      state = 'recording';
      start() {}
      stop() {
        this.state = 'inactive';
        this.onstop?.();
      }
    }
    stubMicrophone({ getTracks: () => [] });
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    renderSourcePanel();

    await user.click(screen.getByRole('button', { name: /record voice note/i }));
    emitAudio(processors[0], [0.12, -0.12, 0.1, -0.1]);

    expect(await screen.findByText('Recording voice note. Microphone is receiving audio.')).toBeInTheDocument();
    expect(screen.getByText('Voice input detected.')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /microphone input level/i })).toHaveAttribute('aria-valuenow', '100');
  });

  it('records mp4 audio when that is the supported browser format', async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn().mockResolvedValue(undefined);
    class FakeRecorder {
      static isTypeSupported(type: string) {
        return type === 'audio/mp4';
      }
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onstop: (() => void) | null = null;
      mimeType = 'audio/mp4';
      state = 'recording';
      start() {
        this.ondataavailable?.({ data: new Blob(['voice'], { type: 'audio/mp4' }) } as BlobEvent);
      }
      requestData() {}
      stop() {
        this.state = 'inactive';
        this.onstop?.();
      }
    }

    stubMicrophone({ getTracks: () => [] });
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    renderSourcePanel({ onUpload });

    await user.click(screen.getByRole('button', { name: /record voice note/i }));
    await user.click(screen.getByRole('button', { name: /stop and submit/i }));

    await waitFor(() => expect(onUpload).toHaveBeenCalledWith(expect.objectContaining({
      name: 'voice-note.m4a',
      type: 'audio/mp4'
    })));
  });

  it('waits for short iOS-style recordings so final audio chunks can be emitted', async () => {
    const user = userEvent.setup();
    const stopTrack = vi.fn();
    const onUpload = vi.fn().mockResolvedValue(undefined);
    const recorderInstances: FakeRecorder[] = [];
    class FakeRecorder {
      static isTypeSupported(type: string) {
        return type === 'audio/mp4;codecs=mp4a.40.2';
      }
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onstop: (() => void) | null = null;
      mimeType = 'audio/mp4;codecs=mp4a.40.2';
      state = 'recording';
      stopCalls = 0;
      constructor() {
        recorderInstances.push(this);
      }
      start() {}
      stop() {
        this.stopCalls += 1;
        this.state = 'inactive';
        this.ondataavailable?.({ data: new Blob(['voice'], { type: 'audio/mp4' }) } as BlobEvent);
        this.onstop?.();
      }
    }

    stubMicrophone({ getTracks: () => [{ stop: stopTrack }] });
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    renderSourcePanel({ onUpload });

    await user.click(screen.getByRole('button', { name: /record voice note/i }));
    await user.click(screen.getByRole('button', { name: /stop and submit/i }));

    expect(screen.getByText(/stopping voice note/i)).toBeInTheDocument();
    expect(recorderInstances[0]?.stopCalls).toBe(0);

    await waitFor(() => expect(recorderInstances[0]?.stopCalls).toBe(1), { timeout: 2000 });

    await waitFor(() => expect(onUpload).toHaveBeenCalledWith(expect.objectContaining({
      name: 'voice-note.m4a',
      type: 'audio/mp4'
    })), { timeout: 2000 });
    expect(stopTrack).toHaveBeenCalledTimes(1);
  });

  it('uses the browser default recorder when no preferred audio type is reported', async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn().mockResolvedValue(undefined);
    class FakeRecorder {
      static isTypeSupported() {
        return false;
      }
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onstop: (() => void) | null = null;
      mimeType = 'audio/wav';
      state = 'recording';
      start() {
        this.ondataavailable?.({ data: new Blob(['voice'], { type: 'audio/wav' }) } as BlobEvent);
      }
      requestData() {}
      stop() {
        this.state = 'inactive';
        this.onstop?.();
      }
    }

    stubMicrophone({ getTracks: () => [] });
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    renderSourcePanel({ onUpload });

    await user.click(screen.getByRole('button', { name: /record voice note/i }));
    await user.click(screen.getByRole('button', { name: /stop and submit/i }));

    await waitFor(() => expect(onUpload).toHaveBeenCalledWith(expect.objectContaining({
      name: 'voice-note.wav',
      type: 'audio/wav'
    })));
  });

  it('surfaces microphone permission failures', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue(new Error('microphone denied')) }
    });
    vi.stubGlobal('MediaRecorder', class FakeRecorder {});
    renderSourcePanel();

    await user.click(screen.getByRole('button', { name: /record voice note/i }));
    expect(await screen.findByText('microphone denied')).toBeInTheDocument();
  });

  it.each([
    ['NotAllowedError', /microphone permission was blocked/i],
    ['SecurityError', /microphone permission was blocked/i],
    ['NotFoundError', /no microphone was found/i],
    ['NotReadableError', /microphone is already in use/i]
  ])('maps %s recorder failures to helpful guidance', async (name, expected) => {
    const user = userEvent.setup();
    const error = new Error(name);
    error.name = name;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue(error) }
    });
    vi.stubGlobal('MediaRecorder', class FakeRecorder {});
    renderSourcePanel();

    await user.click(screen.getByRole('button', { name: /record voice note/i }));
    expect(await screen.findByText(expected)).toBeInTheDocument();
  });

  it('uses a safe generic message for non-error recorder failures', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue('blocked') }
    });
    vi.stubGlobal('MediaRecorder', class FakeRecorder {});
    renderSourcePanel();

    await user.click(screen.getByRole('button', { name: /record voice note/i }));
    expect(await screen.findByText(/voice recording failed/i)).toBeInTheDocument();
  });

  it('keeps recorder errors visible when transcript upload fails', async () => {
    const user = userEvent.setup();
    class FakeRecorder {
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
    stubMicrophone({ getTracks: () => [] });
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    renderSourcePanel({ onUpload: vi.fn().mockRejectedValue(new Error('transcript upload failed')) });

    await user.click(screen.getByRole('button', { name: /record voice note/i }));
    await user.click(screen.getByRole('button', { name: /stop and submit/i }));

    expect(await screen.findByText('transcript upload failed')).toBeInTheDocument();
  });

  it('reports when stop is pressed after the recorder becomes inactive', async () => {
    const user = userEvent.setup();
    class FakeRecorder {
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onstop: (() => void) | null = null;
      mimeType = 'audio/webm';
      state = 'inactive';
      start() {}
    }
    stubMicrophone({ getTracks: () => [] });
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    renderSourcePanel();

    await user.click(screen.getByRole('button', { name: /record voice note/i }));
    await user.click(screen.getByRole('button', { name: /stop and submit/i }));

    expect(await screen.findByText('No active voice recording to stop.')).toBeInTheDocument();
  });

  it('reports when stop is pressed while a voice note is already saving', async () => {
    const user = userEvent.setup();
    class FakeRecorder {
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onstop: (() => void) | null = null;
      mimeType = 'audio/webm';
      state = 'recording';
      start() {
        this.ondataavailable?.({ data: new Blob(['voice'], { type: 'audio/webm' }) } as BlobEvent);
      }
      stop() {
        this.state = 'inactive';
      }
    }
    stubMicrophone({ getTracks: () => [] });
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    renderSourcePanel();

    await user.click(screen.getByRole('button', { name: /record voice note/i }));
    await user.click(screen.getByRole('button', { name: /stop and submit/i }));
    await user.click(screen.getByRole('button', { name: /stop and submit/i }));

    expect(await screen.findByText('Voice note is already being saved.')).toBeInTheDocument();
  });

  it('does not upload empty recorder chunks', async () => {
    const user = userEvent.setup();
    class FakeRecorder {
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onstop: (() => void) | null = null;
      mimeType = 'audio/webm';
      state = 'recording';
      start() {
        this.ondataavailable?.({ data: new Blob([]) } as BlobEvent);
      }
      stop() {
        this.state = 'inactive';
        this.onstop?.();
      }
    }
    stubMicrophone({ getTracks: () => [] });
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    const onUpload = vi.fn().mockResolvedValue(undefined);
    renderSourcePanel({ onUpload });

    await user.click(screen.getByRole('button', { name: /record voice note/i }));
    await user.click(screen.getByRole('button', { name: /stop and submit/i }));

    expect(onUpload).not.toHaveBeenCalled();
    expect(await screen.findByText(/microphone access was granted, but no voice input/i, {}, { timeout: 2500 }))
      .toBeInTheDocument();
  });
});

function renderSourcePanel({ onUpload = vi.fn().mockResolvedValue(undefined) } = {}) {
  return render(
    <SourceIntakePanel
      disabled={false}
      sources={[]}
      error={null}
      onAddText={vi.fn()}
      onUpload={onUpload}
      onWebsite={vi.fn()}
      onRepository={vi.fn()}
    />
  );
}

function stubMicrophone(stream: { getTracks: () => Array<{ stop?: () => void }> }) {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue(stream) }
  });
}

type FakeProcessor = {
  onaudioprocess: ((event: AudioProcessingEvent) => void) | null;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};

function stubAudioContext() {
  const processors: FakeProcessor[] = [];
  class FakeAudioContext {
    sampleRate = 8000;
    state = 'running';
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
