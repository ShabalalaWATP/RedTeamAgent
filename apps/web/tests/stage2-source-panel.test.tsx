import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SourceIntakePanel } from '../src/features/reviews/SourceIntakePanel';
import { Stage2ReviewSettings } from '../src/features/reviews/Stage2ReviewSettings';
import type { Source } from '../src/shared/types';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Stage 2 source intake', () => {
  it('submits rich files, website snapshots and repository URLs without fake voice evidence', async () => {
    const user = userEvent.setup();
    const onAddText = vi.fn().mockResolvedValue(undefined);
    const onUpload = vi.fn().mockResolvedValue(undefined);
    const onWebsite = vi.fn().mockResolvedValue(undefined);
    const onRepository = vi.fn().mockResolvedValue(undefined);

    render(
      <SourceIntakePanel
        disabled={false}
        sources={[
          source({ metadata: { ocr_quality: 'low' }, warnings: ['OCR confidence warning'] }),
          source({ id: 'source-2', filename: 'notes.txt', content_type: 'text/plain' })
        ]}
        error="Source failed"
        onAddText={onAddText}
        onUpload={onUpload}
        onWebsite={onWebsite}
        onRepository={onRepository}
      />
    );

    await user.click(screen.getByRole('button', { name: /add pasted text/i }));
    await user.upload(screen.getByLabelText(/upload rich evidence/i), [
      new File(['data'], 'table.csv', { type: 'text/csv' }),
      new File(['photo'], 'site-photo.jpg', { type: 'image/jpeg' }),
      new File(['voice'], 'field-note.m4a', { type: 'audio/mp4' })
    ]);
    await user.clear(screen.getByLabelText(/website url/i));
    await user.type(screen.getByLabelText(/website url/i), 'https://example.com/audit');
    await user.click(screen.getByRole('button', { name: /snapshot website/i }));
    await user.clear(screen.getByLabelText(/public git repository url/i));
    await user.type(screen.getByLabelText(/public git repository url/i), 'https://github.com/example/repo');
    await user.click(screen.getByRole('button', { name: /ingest repository/i }));
    await user.click(screen.getByRole('button', { name: /record voice note/i }));

    expect(onAddText).toHaveBeenCalledTimes(1);
    expect(onUpload.mock.calls[0][0]).toMatchObject({ name: 'table.csv' });
    expect(onUpload.mock.calls[1][0]).toMatchObject({ name: 'site-photo.jpg' });
    expect(onUpload.mock.calls[2][0]).toMatchObject({ name: 'field-note.m4a' });
    expect(onUpload).toHaveBeenCalledTimes(3);
    expect(onWebsite).toHaveBeenCalledWith('https://example.com/audit');
    expect(onRepository).toHaveBeenCalledWith('https://github.com/example/repo');
    expect(await screen.findByText(/voice recording is not available/i)).toBeInTheDocument();
    expect(screen.getByText('Quality indicator: low')).toBeInTheDocument();
    expect(screen.getByText('OCR confidence warning')).toBeInTheDocument();
    expect(screen.getByText('notes.txt')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Source failed');
    expect(await screen.findByText('Submitted 3 files for analysis.')).toBeInTheDocument();
  });

  it('keeps disabled and empty upload branches inert', async () => {
    const onUpload = vi.fn();
    render(
      <SourceIntakePanel
        disabled
        sources={[]}
        error={null}
        onAddText={vi.fn()}
        onUpload={onUpload}
        onWebsite={vi.fn()}
        onRepository={vi.fn()}
      />
    );

    const recordButton = screen.getByRole('button', { name: /record voice note/i }) as HTMLButtonElement;
    recordButton.disabled = false;
    fireEvent.click(recordButton);
    fireEvent.change(screen.getByLabelText(/upload rich evidence/i), { target: { files: [] } });

    expect(onUpload).not.toHaveBeenCalled();
    expect(screen.getByText('No voice note recorded.')).toBeInTheDocument();
  });

});

describe('Stage 2 review settings', () => {
  it('emits research policy changes', async () => {
    const user = userEvent.setup();
    const handlers = {
      external: vi.fn(),
      privateMode: vi.fn(),
      allow: vi.fn(),
      block: vi.fn()
    };
    render(
      <Stage2ReviewSettings
        externalResearch
        privateResearch={false}
        allowlist=""
        blocklist=""
        onExternalResearch={handlers.external}
        onPrivateResearch={handlers.privateMode}
        onAllowlist={handlers.allow}
        onBlocklist={handlers.block}
      />
    );

    await user.click(screen.getByLabelText(/enable external research/i));
    await user.click(screen.getByLabelText(/private research mode/i));
    fireEvent.change(screen.getByLabelText(/domain allow-list/i), { target: { value: 'example.com' } });
    fireEvent.change(screen.getByLabelText(/domain block-list/i), { target: { value: 'blocked.test' } });

    expect(handlers.external).toHaveBeenCalledWith(false);
    expect(handlers.privateMode).toHaveBeenCalledWith(true);
    expect(handlers.allow).toHaveBeenCalledWith('example.com');
    expect(handlers.block).toHaveBeenCalledWith('blocked.test');
    expect(screen.getByText('Per-run research enabled')).toBeInTheDocument();
    expect(screen.getByText('Full query context allowed')).toBeInTheDocument();
  });
});

function source(overrides: Partial<Source> = {}): Source {
  return {
    id: 'source-1',
    filename: 'diagram.png',
    content_type: 'image/png',
    state: 'ingested',
    metadata: {},
    warnings: [],
    ...overrides
  };
}
