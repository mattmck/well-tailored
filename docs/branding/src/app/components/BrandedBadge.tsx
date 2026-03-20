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
    default: 'bg-secondary text-secondary-foreground border border-border',
    primary: 'bg-primary text-primary-foreground',
    secondary: 'bg-muted/30 text-foreground',
    success: 'bg-green-100 text-green-800 border border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700',
    warning: 'bg-yellow-100 text-yellow-800 border border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700',
    error: 'bg-red-100 text-red-800 border border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700',
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
      <div className="bg-card rounded-lg border border-border p-6 space-y-4">
        <h4 className="m-0 text-card-foreground" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
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

      <div className="bg-card rounded-lg border border-border p-6 space-y-4">
        <h4 className="m-0 text-card-foreground" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
          Badge Sizes
        </h4>
        <div className="flex flex-wrap gap-3 items-center">
          <BrandedBadge variant="primary" size="sm">Small</BrandedBadge>
          <BrandedBadge variant="primary" size="md">Medium</BrandedBadge>
          <BrandedBadge variant="primary" size="lg">Large</BrandedBadge>
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border p-6 space-y-4">
        <h4 className="m-0 text-card-foreground" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
          Use Cases
        </h4>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-foreground" style={{ fontFamily: 'Inter, sans-serif' }}>Application Status:</span>
            <BrandedBadge variant="success">Submitted</BrandedBadge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-foreground" style={{ fontFamily: 'Inter, sans-serif' }}>Feature:</span>
            <BrandedBadge variant="primary">New</BrandedBadge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-foreground" style={{ fontFamily: 'Inter, sans-serif' }}>Priority:</span>
            <BrandedBadge variant="warning">High</BrandedBadge>
          </div>
        </div>
      </div>
    </div>
  );
}