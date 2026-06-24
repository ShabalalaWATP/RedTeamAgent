import { FileUp, GitBranch, Globe2, Mic, Square } from 'lucide-react';
import { useRef, useState } from 'react';
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
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const startVoiceNote = async () => {
    /* v8 ignore next */
    if (disabled) return;
    try {
      if (!supportsRecording()) {
        await onUpload(new File(['Voice-note capture unavailable in this browser.'], 'voice-note.txt', {
          type: 'text/plain'
        }));
        setVoiceStatus('Browser recording unavailable, fallback note submitted.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      streamRef.current = stream;
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const file = new File(chunksRef.current, 'voice-note.webm', { type: mimeType });
        stopTracks();
        setRecording(false);
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
      setRecording(false);
      setVoiceStatus((err as Error).message);
    }
  };

  const stopVoiceNote = () => {
    recorderRef.current?.stop();
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
        <Field
          label="Upload rich evidence"
          hint="TXT, Markdown, PDF, DOCX, PPTX, CSV, XLSX, PNG, JPEG, WebP, audio, video, ZIP or TAR."
        >
          <input type="file" onChange={(event) => void uploadSelected(event.target.files?.[0], onUpload)} disabled={disabled} />
        </Field>
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

async function uploadSelected(file: File | undefined, onUpload: (file: File) => Promise<void>) {
  if (file) await onUpload(file);
}
