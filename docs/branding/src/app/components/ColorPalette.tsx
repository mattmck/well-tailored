const colors = [
  { name: 'Text', token: 'text', hex: '#2B2D33', usage: 'Primary text, wordmark' },
  { name: 'Background', token: 'background', hex: '#F8F5EE', usage: 'Main page background (ivory)' },
  { name: 'Surface', token: 'surface', hex: '#FFFFFF', usage: 'Cards, elevated surfaces' },
  { name: 'Primary', token: 'primary', hex: '#314A74', usage: 'CTAs, links, brand emphasis' },
  { name: 'Primary Hover', token: 'primaryHover', hex: '#253857', usage: 'Hover/active states' },
  { name: 'Muted', token: 'muted', hex: '#747986', usage: 'Secondary/muted text' },
  { name: 'Border', token: 'border', hex: '#E3DDD2', usage: 'Borders, dividers' },
];

const darkColors = [
  { name: 'Text', token: 'text', hex: '#E8E6E1', usage: 'Primary text, wordmark' },
  { name: 'Background', token: 'background', hex: '#1A1D24', usage: 'Main page background (dark)' },
  { name: 'Surface', token: 'surface', hex: '#242831', usage: 'Cards, elevated surfaces' },
  { name: 'Primary', token: 'primary', hex: '#5B7AA8', usage: 'CTAs, links, brand emphasis' },
  { name: 'Primary Hover', token: 'primaryHover', hex: '#6B8AB8', usage: 'Hover/active states' },
  { name: 'Muted', token: 'muted', hex: '#9094A0', usage: 'Secondary/muted text' },
  { name: 'Border', token: 'border', hex: '#353943', usage: 'Borders, dividers' },
];

export function ColorPalette({ isDark = false }: { isDark?: boolean }) {
  const colorSet = isDark ? darkColors : colors;
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {colorSet.map((color) => (
        <div key={color.token} className="bg-card rounded-lg border border-border overflow-hidden">
          <div 
            className="h-24 w-full" 
            style={{ backgroundColor: color.hex }}
          />
          <div className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <h4 
                className="m-0 text-card-foreground"
                style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600 }}
              >
                {color.name}
              </h4>
              <code 
                className="text-sm px-2 py-1 bg-secondary rounded text-muted-foreground"
                style={{ fontFamily: 'monospace' }}
              >
                {color.hex}
              </code>
            </div>
            <p 
              className="m-0 text-sm text-muted-foreground"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              {color.usage}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}