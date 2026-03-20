import { ReactNode } from 'react';

interface BrandedCardProps {
  title?: string;
  description?: string;
  children?: ReactNode;
  className?: string;
  elevated?: boolean;
}

export function BrandedCard({ 
  title, 
  description, 
  children, 
  className = '',
  elevated = false 
}: BrandedCardProps) {
  return (
    <div 
      className={`bg-white rounded-lg border border-[#E3DDD2] overflow-hidden ${
        elevated ? 'shadow-sm' : ''
      } ${className}`}
    >
      {(title || description) && (
        <div className="p-6 border-b border-[#E3DDD2]">
          {title && (
            <h3 
              className="m-0"
              style={{ 
                fontFamily: 'Manrope, sans-serif', 
                fontWeight: 600,
                fontSize: '1.375rem',
                color: '#2B2D33'
              }}
            >
              {title}
            </h3>
          )}
          {description && (
            <p 
              className="m-0 mt-2"
              style={{ 
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.875rem',
                color: '#747986',
                lineHeight: 1.5
              }}
            >
              {description}
            </p>
          )}
        </div>
      )}
      {children && <div className="p-6">{children}</div>}
    </div>
  );
}

export function CardShowcase() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <BrandedCard 
        title="Simple Card"
        description="A basic card with title and description"
      >
        <p style={{ fontFamily: 'Inter, sans-serif', margin: 0 }}>
          This is the card content area. Cards use white backgrounds and subtle borders for a clean, professional appearance.
        </p>
      </BrandedCard>

      <BrandedCard 
        title="Elevated Card"
        description="Cards can have subtle shadows for depth"
        elevated
      >
        <p style={{ fontFamily: 'Inter, sans-serif', margin: 0 }}>
          The elevated variant adds a subtle shadow to create visual hierarchy.
        </p>
      </BrandedCard>

      <BrandedCard className="md:col-span-2">
        <div className="space-y-4">
          <h4 className="m-0" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
            Card Without Header
          </h4>
          <p style={{ fontFamily: 'Inter, sans-serif', margin: 0, color: '#747986' }}>
            Cards are flexible and can be used without titles or descriptions for more custom layouts.
          </p>
        </div>
      </BrandedCard>
    </div>
  );
}
