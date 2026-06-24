import { PlugZap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../app/AuthContext';
import { Button, EmptyState, ErrorState, Field, Status } from '../../shared/ui';

type AdapterField = {
  name: string;
  label: string;
  secret: boolean;
  required: boolean;
  input_type: string;
};

type AdapterSchema = {
  key: string;
  label: string;
  fields: AdapterField[];
  default_capabilities: string[];
};

export function ProviderSettings() {
  const { auth } = useAuth();
  const [schemas, setSchemas] = useState<AdapterSchema[]>([]);
  const [selected, setSelected] = useState('fake');
  const [name, setName] = useState('Fake local provider');
  const [values, setValues] = useState<Record<string, string>>({ scenario: 'valid' });
  const [result, setResult] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.adapterSchemas().then((data) => setSchemas(data as AdapterSchema[])).catch((err) => setError(err.message));
  }, []);

  const schema = schemas.find((item) => item.key === selected);
  const create = async () => {
    if (!auth || !schema) return;
    setError(null);
    const credentials = Object.fromEntries(schema.fields.filter((field) => field.secret).map((field) => [field.name, values[field.name] ?? '']));
    const config = Object.fromEntries(schema.fields.filter((field) => !field.secret).map((field) => [field.name, values[field.name] ?? '']));
    try {
      await api.createProviderConnection(auth.csrfToken, {
        workspace_id: auth.workspaceId,
        adapter: schema.key,
        name,
        config,
        credentials
      });
      setResult('Provider connection saved and tested. Credentials were not returned to the browser.');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <section className="screen">
      <div className="screen-header">
        <div>
          <h1>Provider settings</h1>
          <p className="muted">Adapter schemas generate the form. Routing stays deterministic and server-side.</p>
        </div>
        <Status tone="warn">Credentials write-only</Status>
      </div>
      <div className="grid">
        <form className="panel stack" onSubmit={(event) => event.preventDefault()}>
          <Field label="Adapter">
            <select value={selected} onChange={(event) => setSelected(event.target.value)}>
              {schemas.map((item) => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Connection name">
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          {schema?.fields.map((field) => (
            <Field key={field.name} label={field.label} hint={field.secret ? 'Stored server-side only.' : undefined}>
              <input
                type={field.secret ? 'password' : field.input_type}
                value={values[field.name] ?? ''}
                onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                required={field.required}
              />
            </Field>
          ))}
          <ErrorState message={error} />
          <Button type="button" variant="primary" onClick={create}><PlugZap size={16} /> Test and save</Button>
        </form>
        <aside className="panel stack">
          <h2>Capability record</h2>
          {schema ? (
            <>
              <Status tone="info">{schema.label}</Status>
              <ul>
                {schema.default_capabilities.map((capability) => <li key={capability}>{capability}</li>)}
              </ul>
              <p className="muted">{result || 'Capability provenance appears after a connection is saved.'}</p>
            </>
          ) : (
            <EmptyState title="No adapters" body="The API has not returned adapter schemas yet." />
          )}
        </aside>
      </div>
    </section>
  );
}
