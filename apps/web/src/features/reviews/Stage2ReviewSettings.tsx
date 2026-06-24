import { Search, Shield } from 'lucide-react';
import { Field, Status } from '../../shared/ui';

type Stage2ReviewSettingsProps = {
  externalResearch: boolean;
  privateResearch: boolean;
  allowlist: string;
  blocklist: string;
  onExternalResearch: (value: boolean) => void;
  onPrivateResearch: (value: boolean) => void;
  onAllowlist: (value: string) => void;
  onBlocklist: (value: string) => void;
};

export function Stage2ReviewSettings({
  externalResearch,
  privateResearch,
  allowlist,
  blocklist,
  onExternalResearch,
  onPrivateResearch,
  onAllowlist,
  onBlocklist
}: Stage2ReviewSettingsProps) {
  return (
    <section className="panel stack" aria-labelledby="stage2-research-heading">
      <div className="section-title">
        <Search size={18} />
        <h2 id="stage2-research-heading">Research policy</h2>
      </div>
      <label className="check-row">
        <input
          type="checkbox"
          checked={externalResearch}
          onChange={(event) => onExternalResearch(event.target.checked)}
        />
        Enable external research for this review
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={privateResearch}
          onChange={(event) => onPrivateResearch(event.target.checked)}
          disabled={!externalResearch}
        />
        Private research mode
      </label>
      <div className="row">
        <Field label="Domain allow-list" hint="Comma-separated domains. Leave blank for policy default.">
          <input value={allowlist} onChange={(event) => onAllowlist(event.target.value)} />
        </Field>
        <Field label="Domain block-list" hint="Comma-separated domains excluded from research and snapshots.">
          <input value={blocklist} onChange={(event) => onBlocklist(event.target.value)} />
        </Field>
      </div>
      <div className="row" aria-label="Research mode summary">
        <Shield size={16} aria-hidden="true" />
        <Status tone={externalResearch ? 'warn' : 'info'}>
          {externalResearch ? 'Per-run research enabled' : 'External research disabled'}
        </Status>
        <Status tone={privateResearch ? 'ok' : 'warn'}>
          {privateResearch ? 'Sensitive query guard on' : 'Full query context allowed'}
        </Status>
      </div>
    </section>
  );
}
