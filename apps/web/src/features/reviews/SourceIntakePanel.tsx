import { FileUp, GitBranch, Globe2, Mic, Square } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import type { Source } from '../../shared/types';
import { Button, EmptyState, ErrorState, Field, Status } from '../../shared/ui';
import { startVoiceCapture, supportsVoiceCapture, type VoiceCaptureSession } from './voiceCapture';

type SourceIntakePanelProps = {
  disabled: boolean;
  sources: Source[];
  error: string | null;
  onAddText: () => Promise<void>;
  onUpload: (file: File) => Promise<void>;
  onWebsite: (url: string) => Promise<void>;
  onRepository: (url: string) => Promise<void>;
};

export function SourceIntakePanel({
  disabled,
  sources,
  error,
  onAddText,
  onUpload,
  onWebsite,
  onRepository
}: SourceIntakePanelProps) {
  const [websiteUrl, setWebsiteUrl] = useState('https://example.com/decision-brief');
  const [repositoryUrl, setRepositoryUrl] = useState('https://github.com/example/decision-review');
  const [recording, setRecording] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('No voice note recorded.');
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [voiceSignal, setVoiceSignal] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('No files selected.');
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const captureRef = useRef<VoiceCaptureSession | null>(null);
  const voiceSignalRef = useRef(false);
  const stopPendingRef = useRef(false);

  const startVoiceNote = async () => {
    /* v8 ignore next */
    if (disabled) return;
    try {
      if (!supportsVoiceCapture()) {
        setVoiceStatus('Voice recording is not available in this browser. Upload an audio file instead.');
        return;
      }
      setVoiceLevel(0);
      setVoiceSignal(false);
      voiceSignalRef.current = false;
      stopPendingRef.current = false;
      const capture = await startVoiceCapture((level, hasSignal) => {
        setVoiceLevel(level);
        if (hasSignal && !voiceSignalRef.current) {
          voiceSignalRef.current = true;
          setVoiceSignal(true);
          setVoiceStatus('Recording voice note. Microphone is receiving audio.');
        }
      });
      captureRef.current = capture;
      setRecording(true);
      setVoiceStatus('Microphone access granted. Waiting for voice input.');
    } catch (err) {
      captureRef.current?.dispose();
      captureRef.current = null;
      setRecording(false);
      setVoiceStatus(recordingErrorMessage(err));
    }
  };

  const stopVoiceNote = () => {
    const capture = captureRef.current;
    if (stopPendingRef.current) {
      setVoiceStatus('Voice note is already being saved.');
      return;
    }
    if (!capture || !capture.isActive()) {
      setVoiceStatus('No active voice recording to stop.');
      return;
    }
    stopPendingRef.current = true;
    setVoiceStatus('Stopping voice note and checking captured audio.');
    void capture.stop()
      .then((result) => submitVoiceNote(result.file, result.source, result.hadSignal))
      .catch((err: unknown) => setVoiceStatus(recordingErrorMessage(err)));
  };

  const submitVoiceNote = (file: File | null, source: string, hadSignal: boolean) => {
    captureRef.current = null;
    stopPendingRef.current = false;
    setRecording(false);
    setVoiceLevel(0);
    if (!file || file.size === 0) {
      const detail = hadSignal
        ? 'Microphone sound was detected, but the browser did not return a usable audio file. Try Safari with this tab open, or upload a Voice Memos recording as evidence.'
        : 'Microphone access was granted, but no voice input was detected. Check iPhone microphone permission for this browser and try again.';
      setVoiceStatus(detail);
      return;
    }
    const fallbackNote = source === 'wav-fallback' ? ' using a mobile-safe fallback' : '';
    setVoiceStatus(`Voice note captured${fallbackNote}, submitting transcript source.`);
    void onUpload(file)
      .then(() => setVoiceStatus('Voice note submitted for timestamped transcription.'))
      .catch((err: unknown) => setVoiceStatus((err as Error).message));
  };

  return (
    <section className="panel stack" aria-labelledby="sources-heading">
      <h2 id="sources-heading">Sources and snapshots</h2>
      <div className="row">
        <Button type="button" onClick={() => void onAddText()} disabled={disabled}>
          Add pasted text
        </Button>
        <div className="field source-upload-field">
          <label htmlFor={fileInputId}>Upload rich evidence</label>
          <div className="file-upload-control">
            <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={disabled}>
              <FileUp size={16} /> Choose files
            </Button>
            <span className="muted" role="status">{uploadStatus}</span>
          </div>
          <input
            id={fileInputId}
            ref={fileInputRef}
            className="visually-hidden-file"
            type="file"
            multiple
            accept=".txt,.md,.markdown,.pdf,.docx,.pptx,.csv,.xlsx,.png,.jpg,.jpeg,.webp,.mp3,.wav,.webm,.m4a,.mp4,.mov,.zip,.tar,.gz,.tgz,text/plain,text/markdown,text/csv,application/pdf,image/*,audio/*,video/*"
            aria-describedby={`${fileInputId}-hint`}
            onChange={(event) => {
              const input = event.currentTarget;
              void uploadSelected(Array.from(input.files ?? []), onUpload, setUploadStatus)
                .finally(() => {
                  input.value = '';
                });
            }}
            disabled={disabled}
          />
          <small id={`${fileInputId}-hint`}>
            TXT, Markdown, PDF, DOCX, PPTX, CSV, XLSX, PNG, JPEG, WebP, audio, video, ZIP or TAR.
          </small>
        </div>
      </div>
      <div className="row">
        <Field label="Website URL">
          <input value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} disabled={disabled} />
        </Field>
        <Button type="button" onClick={() => void onWebsite(websiteUrl)} disabled={disabled || !websiteUrl.trim()}>
          <Globe2 size={16} /> Snapshot website
        </Button>
      </div>
      <div className="row">
        <Field label="Public Git repository URL">
          <input value={repositoryUrl} onChange={(event) => setRepositoryUrl(event.target.value)} disabled={disabled} />
        </Field>
        <Button type="button" onClick={() => void onRepository(repositoryUrl)} disabled={disabled || !repositoryUrl.trim()}>
          <GitBranch size={16} /> Ingest repository
        </Button>
      </div>
      <div className="row" aria-label="Voice note controls">
        <Button type="button" onClick={() => void startVoiceNote()} disabled={disabled || recording}>
          <Mic size={16} /> Record voice note
        </Button>
        <Button type="button" onClick={stopVoiceNote} disabled={!recording}>
          <Square size={16} /> Stop and submit
        </Button>
        <span className="muted" role="status">{voiceStatus}</span>
      </div>
      {recording ? <VoiceInputMeter level={voiceLevel} active={voiceSignal} /> : null}
      <ErrorState message={error} />
      {sources.length === 0 ? (
        <EmptyState title="No evidence yet" body="Add text, rich files, websites, voice, video or repository evidence." />
      ) : (
        <div className="list">
          {sources.map((source) => <SourceCard key={source.id} source={source} />)}
        </div>
      )}
    </section>
  );
}

function VoiceInputMeter({ level, active }: { level: number; active: boolean }) {
  const percentage = Math.max(4, Math.round(level * 100));
  return (
    <div className="voice-input-meter">
      <div
        className="voice-input-bar"
        role="progressbar"
        aria-label="Microphone input level"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage}
      >
        <span className={active ? 'is-active' : ''} style={{ width: `${percentage}%` }} />
      </div>
      <small className="muted">{active ? 'Voice input detected.' : 'No voice input detected yet.'}</small>
    </div>
  );
}

function SourceCard({ source }: { source: Source }) {
  const quality = source.metadata.ocr_quality ?? source.metadata.transcript_quality ?? source.metadata.source_kind;
  return (
    <article className="list-item">
      <div className="stack">
        <span><FileUp size={16} /> {source.filename}</span>
        <small className="muted">{source.content_type}</small>
        {quality ? <small className="muted">Quality indicator: {String(quality)}</small> : null}
        {source.warnings.map((warning) => <small className="warning-text" key={warning}>{warning}</small>)}
      </div>
      <Status tone={source.state === 'ingested' ? 'ok' : 'bad'}>{source.state}</Status>
    </article>
  );
}

function recordingErrorMessage(err: unknown) {
  if (!(err instanceof Error)) return 'Voice recording failed. Check microphone permission and try again.';
  if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
    return 'Microphone permission was blocked. Allow microphone access for this site and try again.';
  }
  if (err.name === 'NotFoundError') return 'No microphone was found on this device.';
  if (err.name === 'NotReadableError') return 'The microphone is already in use or cannot be opened.';
  return err.message || 'Voice recording failed. Check microphone permission and try again.';
}

async function uploadSelected(
  files: File[],
  onUpload: (file: File) => Promise<void>,
  setUploadStatus: (message: string) => void
) {
  if (files.length === 0) return;
  setUploadStatus(`Uploading ${files.length} ${files.length === 1 ? 'file' : 'files'}.`);
  for (const file of files) {
    await onUpload(file);
  }
  setUploadStatus(`Submitted ${files.length} ${files.length === 1 ? 'file' : 'files'} for analysis.`);
}
