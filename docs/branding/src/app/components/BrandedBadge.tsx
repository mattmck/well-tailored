import { ReactNode } from 'react';

interface BrandedBadgeProps {
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  className?: string;
}

export function BrandedBadge({ 
  variant = 'default', 
  size = 'md', 
  children,
  className = '' 
}: BrandedBadgeProps) {
  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  const variantStyles = {
    default: 'bg-[#F8F5EE] text-[#2B2D33] border border-[#E3DDD2]',
    primary: 'bg-[#314A74] text-white',
    secondary: 'bg-[#E3DDD2] text-[#2B2D33]',
    success: 'bg-green-100 text-green-800 border border-green-300',
    warning: 'bg-yellow-100 text-yellow-800 border border-yellow-300',
    error: 'bg-red-100 text-red-800 border border-red-300',
  };

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      style={{ 
        fontFamily: 'Inter, sans-serif',
        fontWeight: 600,
        letterSpacing: '0.01em'
      }}
    >
      {children}
    </span>
  );
}

export function BadgeShowcase() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-[#E3DDD2] p-6 space-y-4">
        <h4 className="m-0" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
          Badge Variants
        </h4>
        <div className="flex flex-wrap gap-3 items-center">
          <BrandedBadge variant="default">Default</BrandedBadge>
          <BrandedBadge variant="primary">Primary</BrandedBadge>
          <BrandedBadge variant="secondary">Secondary</BrandedBadge>
          <BrandedBadge variant="success">Success</BrandedBadge>
          <BrandedBadge variant="warning">Warning</BrandedBadge>
          <BrandedBadge variant="error">Error</BrandedBadge>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-[#E3DDD2] p-6 space-y-4">
        <h4 className="m-0" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
          Badge Sizes
        </h4>
        <div className="flex flex-wrap gap-3 items-center">
          <BrandedBadge variant="primary" size="sm">Small</BrandedBadge>
          <BrandedBadge variant="primary" size="md">Medium</BrandedBadge>
          <BrandedBadge variant="primary" size="lg">Large</BrandedBadge>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-[#E3DDD2] p-6 space-y-4">
        <h4 className="m-0" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
          Use Cases
        </h4>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span style={{ fontFamily: 'Inter, sans-serif' }}>Application Status:</span>
            <BrandedBadge variant="success">Submitted</BrandedBadge>
          </div>
          <div className="flex items-center gap-2">
            <span style={{ fontFamily: 'Inter, sans-serif' }}>Feature:</span>
            <BrandedBadge variant="primary">New</BrandedBadge>
          </div>
          <div className="flex items-center gap-2">
            <span style={{ fontFamily: 'Inter, sans-serif' }}>Priority:</span>
            <BrandedBadge variant="warning">High</BrandedBadge>
          </div>
        </div>
      </div>
    </div>
  );
}
