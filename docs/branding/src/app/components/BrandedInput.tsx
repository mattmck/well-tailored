import { InputHTMLAttributes } from 'react';

interface BrandedInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function BrandedInput({ 
  label, 
  error, 
  helperText,
  className = '',
  ...props 
}: BrandedInputProps) {
  return (
    <div className="space-y-2">
      {label && (
        <label 
          className="block text-card-foreground"
          style={{ 
            fontFamily: 'Inter, sans-serif', 
            fontWeight: 600,
            fontSize: '0.875rem'
          }}
        >
          {label}
        </label>
      )}
      <input
        className={`w-full px-4 py-3 bg-input-background border rounded-lg transition-all duration-200 text-foreground ${
          error 
            ? 'border-destructive focus:border-destructive focus:ring-2 focus:ring-destructive/20' 
            : 'border-border focus:border-primary focus:ring-2 focus:ring-primary/10'
        } outline-none ${className}`}
        style={{ 
          fontFamily: 'Inter, sans-serif',
          fontSize: '1rem'
        }}
        {...props}
      />
      {error && (
        <p 
          className="m-0 text-destructive"
          style={{ 
            fontFamily: 'Inter, sans-serif',
            fontSize: '0.875rem'
          }}
        >
          {error}
        </p>
      )}
      {helperText && !error && (
        <p 
          className="m-0 text-muted-foreground"
          style={{ 
            fontFamily: 'Inter, sans-serif',
            fontSize: '0.875rem'
          }}
        >
          {helperText}
        </p>
      )}
    </div>
  );
}

interface BrandedTextareaProps extends InputHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  rows?: number;
}

export function BrandedTextarea({ 
  label, 
  error, 
  helperText,
  rows = 4,
  className = '',
  ...props 
}: BrandedTextareaProps) {
  return (
    <div className="space-y-2">
      {label && (
        <label 
          className="block text-card-foreground"
          style={{ 
            fontFamily: 'Inter, sans-serif', 
            fontWeight: 600,
            fontSize: '0.875rem'
          }}
        >
          {label}
        </label>
      )}
      <textarea
        rows={rows}
        className={`w-full px-4 py-3 bg-input-background border rounded-lg transition-all duration-200 text-foreground ${
          error 
            ? 'border-destructive focus:border-destructive focus:ring-2 focus:ring-destructive/20' 
            : 'border-border focus:border-primary focus:ring-2 focus:ring-primary/10'
        } outline-none resize-y ${className}`}
        style={{ 
          fontFamily: 'Inter, sans-serif',
          fontSize: '1rem'
        }}
        {...props}
      />
      {error && (
        <p 
          className="m-0 text-destructive"
          style={{ 
            fontFamily: 'Inter, sans-serif',
            fontSize: '0.875rem'
          }}
        >
          {error}
        </p>
      )}
      {helperText && !error && (
        <p 
          className="m-0 text-muted-foreground"
          style={{ 
            fontFamily: 'Inter, sans-serif',
            fontSize: '0.875rem'
          }}
        >
          {helperText}
        </p>
      )}
    </div>
  );
}

export function InputShowcase() {
  return (
    <div className="space-y-6">
      <div className="bg-card rounded-lg border border-border p-6 space-y-6">
        <BrandedInput 
          label="Full Name" 
          placeholder="Enter your full name"
          helperText="This is helper text to guide the user"
        />
        
        <BrandedInput 
          label="Email Address" 
          type="email"
          placeholder="you@example.com"
        />
        
        <BrandedInput 
          label="Invalid Input" 
          placeholder="This field has an error"
          error="This field is required"
        />

        <BrandedTextarea
          label="Message"
          placeholder="Enter your message here..."
          helperText="Maximum 500 characters"
        />
      </div>
    </div>
  );
}