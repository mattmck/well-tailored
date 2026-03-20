const colors = [
  { name: 'Text', token: 'text', hex: '#2B2D33', usage: 'Primary text, wordmark' },
  { name: 'Background', token: 'background', hex: '#F8F5EE', usage: 'Main page background (ivory)' },
  { name: 'Surface', token: 'surface', hex: '#FFFFFF', usage: 'Cards, elevated surfaces' },
  { name: 'Primary', token: 'primary', hex: '#314A74', usage: 'CTAs, links, brand emphasis' },
  { name: 'Primary Hover', token: 'primaryHover', hex: '#253857', usage: 'Hover/active states' },
  { name: 'Muted', token: 'muted', hex: '#747986', usage: 'Secondary/muted text' },
  { name: 'Border', token: 'border', hex: '#E3DDD2', usage: 'Borders, dividers' },
];

export function ColorPalette() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {colors.map((color) => (
        <div key={color.token} className="bg-white rounded-lg border border-[#E3DDD2] overflow-hidden">
          <div 
            className="h-24 w-full" 
            style={{ backgroundColor: color.hex }}
          />
          <div className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <h4 
                className="m-0"
                style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600 }}
              >
                {color.name}
              </h4>
              <code 
                className="text-sm px-2 py-1 bg-[#F8F5EE] rounded"
                style={{ fontFamily: 'monospace', color: '#747986' }}
              >
                {color.hex}
              </code>
            </div>
            <p 
              className="m-0 text-sm"
              style={{ color: '#747986', fontFamily: 'Inter, sans-serif' }}
            >
              {color.usage}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
