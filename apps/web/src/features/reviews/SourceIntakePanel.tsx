import { FileUp, GitBranch, Globe2, Mic, Square } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import type { Source } from '../../shared/types';
import { Button, EmptyState, ErrorState, Field, Status } from '../../shared/ui';

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
  const [uploadStatus, setUploadStatus] = useState('No files selected.');
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const startVoiceNote = async () => {
    /* v8 ignore next */
    if (disabled) return;
    try {
      if (!supportsRecording()) {
        setVoiceStatus('Voice recording is not available in this browser. Upload an audio file instead.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = preferredAudioMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      streamRef.current = stream;
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const captured = chunksRef.current.filter((chunk) => chunk.size > 0);
        const capturedType = baseMimeType(recorder.mimeType || mimeType || 'audio/webm');
        const file = new File(captured, voiceFilename(capturedType), { type: capturedType });
        stopTracks();
        recorderRef.current = null;
        setRecording(false);
        if (file.size === 0) {
          setVoiceStatus('No audio was captured. Check the microphone permission and try again.');
          return;
        }
        setVoiceStatus('Voice note captured, submitting transcript source.');
        void onUpload(file)
          .then(() => setVoiceStatus('Voice note submitted for timestamped transcription.'))
          .catch((err: unknown) => setVoiceStatus((err as Error).message));
      };
      recorder.start();
      setRecording(true);
      setVoiceStatus('Recording voice note.');
    } catch (err) {
      stopTracks();
      recorderRef.current = null;
      setRecording(false);
      setVoiceStatus(recordingErrorMessage(err));
    }
  };

  const stopVoiceNote = () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      setVoiceStatus('No active voice recording to stop.');
      return;
    }
    setVoiceStatus('Stopping voice note and saving evidence.');
    recorder.requestData?.();
    recorder.stop();
  };

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
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

function supportsRecording() {
  return typeof navigator !== 'undefined'
    && Boolean(navigator.mediaDevices?.getUserMedia)
    && typeof MediaRecorder !== 'undefined';
}

function preferredAudioMimeType() {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return '';
  for (const type of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
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
