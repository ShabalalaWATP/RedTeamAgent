import { PlugZap, RefreshCcw } from 'lucide-react';
import { Button, EmptyState, Field } from '../../shared/ui';
import { ModelDropdown } from './ModelDropdown';
import { adapterFieldHint, type AdapterSchema, type CatalogueModel } from './providerCatalogue';

type ProviderConnectionFormProps = {
  schemas: AdapterSchema[];
  visibleSchemas: AdapterSchema[];
  schema?: AdapterSchema;
  selected: string;
  name: string;
  values: Record<string, string>;
  defaultModelIdentifier: string;
  defaultModelOptions: CatalogueModel[];
  loadingModels: boolean;
  onSelectedChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onValuesChange: (value: Record<string, string>) => void;
  onDefaultModelIdentifierChange: (value: string) => void;
  onLoadProviderModels: () => void;
  onCreateConnection: () => void;
};

export function ProviderConnectionForm({
  schemas,
  visibleSchemas,
  schema,
  selected,
  name,
  values,
  defaultModelIdentifier,
  defaultModelOptions,
  loadingModels,
  onSelectedChange,
  onNameChange,
  onValuesChange,
  onDefaultModelIdentifierChange,
  onLoadProviderModels,
  onCreateConnection
}: ProviderConnectionFormProps) {
  return (
    <form className="panel stack" onSubmit={(event) => event.preventDefault()}>
      <h2>Connect an AI provider</h2>
      {schemas.length === 0 ? (
        <EmptyState title="No adapters" body="No provider adapters are available in this environment." />
      ) : null}
      <Field label="AI provider" hint="This controls where RedTeamAgent sends AI review requests.">
        <select value={selected} onChange={(event) => onSelectedChange(event.target.value)}>
          {visibleSchemas.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
        </select>
      </Field>
      <Field label="Display name" hint="An internal label, for example 'OpenAI production'. This is not a URL.">
        <input value={name} onChange={(event) => onNameChange(event.target.value)} />
      </Field>
      {schema?.fields.map((field) => (
        <Field key={field.name} label={field.label} hint={adapterFieldHint(field)}>
          <input
            type={field.secret ? 'password' : field.input_type}
            value={values[field.name] ?? ''}
            onChange={(event) => onValuesChange({ ...values, [field.name]: event.target.value })}
            required={field.required}
          />
        </Field>
      ))}
      <Button type="button" onClick={onLoadProviderModels} disabled={!schema || loadingModels}>
        <RefreshCcw size={16} /> {loadingModels ? 'Loading models' : 'Load models'}
      </Button>
      <Field label="Model" hint="Load the provider's live model list, then choose the model RedTeamAgent should use.">
        <ModelDropdown
          value={defaultModelIdentifier}
          options={defaultModelOptions}
          onChange={onDefaultModelIdentifierChange}
        />
      </Field>
      <Button type="button" variant="primary" onClick={onCreateConnection} disabled={!schema || !defaultModelIdentifier}>
        <PlugZap size={16} /> Test and save
      </Button>
    </form>
  );
}
