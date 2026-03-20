import { ButtonHTMLAttributes, ReactNode } from 'react';

interface BrandedButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

export function BrandedButton({ 
  variant = 'primary', 
  size = 'md', 
  children, 
  className = '',
  disabled,
  ...props 
}: BrandedButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center rounded-lg transition-all duration-200 font-semibold';
  
  const sizeStyles = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  const variantStyles = {
    primary: 'bg-primary text-primary-foreground hover:opacity-90 active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed',
    secondary: 'bg-secondary text-secondary-foreground hover:opacity-90 active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed',
    outline: 'bg-transparent border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed',
    ghost: 'bg-transparent text-primary hover:bg-secondary active:bg-accent disabled:opacity-50 disabled:cursor-not-allowed',
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      style={{ fontFamily: 'Inter, sans-serif' }}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

export function ButtonShowcase() {
  return (
    <div className="space-y-8">
      {/* Primary Buttons */}
      <div className="bg-card rounded-lg border border-border p-6 space-y-4">
        <h4 className="m-0 mb-4 text-card-foreground" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
          Primary Buttons
        </h4>
        <div className="flex flex-wrap gap-4 items-center">
          <BrandedButton variant="primary" size="sm">Small Button</BrandedButton>
          <BrandedButton variant="primary" size="md">Medium Button</BrandedButton>
          <BrandedButton variant="primary" size="lg">Large Button</BrandedButton>
          <BrandedButton variant="primary" size="md" disabled>Disabled</BrandedButton>
        </div>
      </div>

      {/* Secondary Buttons */}
      <div className="bg-card rounded-lg border border-border p-6 space-y-4">
        <h4 className="m-0 mb-4 text-card-foreground" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
          Secondary Buttons
        </h4>
        <div className="flex flex-wrap gap-4 items-center">
          <BrandedButton variant="secondary" size="sm">Small Button</BrandedButton>
          <BrandedButton variant="secondary" size="md">Medium Button</BrandedButton>
          <BrandedButton variant="secondary" size="lg">Large Button</BrandedButton>
          <BrandedButton variant="secondary" size="md" disabled>Disabled</BrandedButton>
        </div>
      </div>

      {/* Outline Buttons */}
      <div className="bg-card rounded-lg border border-border p-6 space-y-4">
        <h4 className="m-0 mb-4 text-card-foreground" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
          Outline Buttons
        </h4>
        <div className="flex flex-wrap gap-4 items-center">
          <BrandedButton variant="outline" size="sm">Small Button</BrandedButton>
          <BrandedButton variant="outline" size="md">Medium Button</BrandedButton>
          <BrandedButton variant="outline" size="lg">Large Button</BrandedButton>
          <BrandedButton variant="outline" size="md" disabled>Disabled</BrandedButton>
        </div>
      </div>

      {/* Ghost Buttons */}
      <div className="bg-card rounded-lg border border-border p-6 space-y-4">
        <h4 className="m-0 mb-4 text-card-foreground" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
          Ghost Buttons
        </h4>
        <div className="flex flex-wrap gap-4 items-center">
          <BrandedButton variant="ghost" size="sm">Small Button</BrandedButton>
          <BrandedButton variant="ghost" size="md">Medium Button</BrandedButton>
          <BrandedButton variant="ghost" size="lg">Large Button</BrandedButton>
          <BrandedButton variant="ghost" size="md" disabled>Disabled</BrandedButton>
        </div>
      </div>
    </div>
  );
}