import { useWorkspace } from '../../context';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

function formatProviderName(providerId: string): string {
  if (providerId === 'azure') return 'Azure OpenAI';
  if (providerId === 'openai') return 'OpenAI';
  return providerId.replace(/[-_]+/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());
}

export function ConfigPanel() {
  const { state, dispatch } = useWorkspace();

  const { configProviders, tailorProvider, tailorModel, scoreProvider, scoreModel } = state;
  const savedOnlyProviders = [tailorProvider, scoreProvider]
    .filter((provider) => provider !== 'auto')
    .filter((provider, index, items) => items.indexOf(provider) === index)
    .filter((provider) => !configProviders.some((entry) => entry.id === provider))
    .map((provider) => ({
      id: provider,
      name: `${formatProviderName(provider)} (saved)`,
      models: ['auto'],
    }));
  const providerOptions = [...configProviders, ...savedOnlyProviders];

  // Server model lists already include "auto" as first entry
  const tailorProviderModels =
    Array.from(new Set([
      ...(providerOptions.find((p) => p.id === tailorProvider)?.models ?? ['auto']),
      tailorModel,
    ].filter(Boolean)));

  const scoreProviderModels =
    Array.from(new Set([
      ...(providerOptions.find((p) => p.id === scoreProvider)?.models ?? ['auto']),
      scoreModel,
    ].filter(Boolean)));

  function handleTailorProviderChange(value: string) {
    dispatch({ type: 'SET_TAILOR_PROVIDER', provider: value });
    dispatch({ type: 'SET_TAILOR_MODEL', model: 'auto' });
    if (scoreProvider === 'auto') {
      dispatch({ type: 'SET_SCORE_PROVIDER', provider: value });
    }
  }

  function handleTailorModelChange(value: string) {
    dispatch({ type: 'SET_TAILOR_MODEL', model: value });
  }

  function handleScoreProviderChange(value: string) {
    dispatch({ type: 'SET_SCORE_PROVIDER', provider: value });
    dispatch({ type: 'SET_SCORE_MODEL', model: 'auto' });
  }

  function handleScoreModelChange(value: string) {
    dispatch({ type: 'SET_SCORE_MODEL', model: value });
  }

  const groupLabelClass =
    'text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5';
  const fieldLabelClass = 'text-xs text-muted-foreground mb-1';

  return (
    <div className="space-y-5">
      {/* Tailoring group */}
      <div>
        <p className={groupLabelClass}>Tailoring</p>
        <div className="space-y-3">
          <div>
            <Label className={fieldLabelClass}>Provider</Label>
            <Select value={tailorProvider} onValueChange={handleTailorProviderChange}>
              <SelectTrigger className="w-full bg-background border border-border rounded-md text-sm">
                <SelectValue placeholder="auto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">auto</SelectItem>
                {providerOptions.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className={fieldLabelClass}>Model</Label>
            <Select value={tailorModel} onValueChange={handleTailorModelChange}>
              <SelectTrigger className="w-full bg-background border border-border rounded-md text-sm">
                <SelectValue placeholder="auto" />
              </SelectTrigger>
              <SelectContent>
                {tailorProviderModels.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Scoring group */}
      <div>
        <p className={groupLabelClass}>Scoring</p>
        <div className="space-y-3">
          <div>
            <Label className={fieldLabelClass}>Provider</Label>
            <Select value={scoreProvider} onValueChange={handleScoreProviderChange}>
              <SelectTrigger className="w-full bg-background border border-border rounded-md text-sm">
                <SelectValue placeholder="auto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">auto</SelectItem>
                {providerOptions.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className={fieldLabelClass}>Model</Label>
            <Select value={scoreModel} onValueChange={handleScoreModelChange}>
              <SelectTrigger className="w-full bg-background border border-border rounded-md text-sm">
                <SelectValue placeholder="auto" />
              </SelectTrigger>
              <SelectContent>
                {scoreProviderModels.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
