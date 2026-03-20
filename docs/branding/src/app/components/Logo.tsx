import logoImage from 'figma:asset/60d160a8ba701194eb5ee91feccf319c08ab00bc.png';

interface LogoProps {
  variant?: 'full' | 'icon' | 'wordmark';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeMap = {
  sm: 'h-8',
  md: 'h-12',
  lg: 'h-16',
  xl: 'h-24',
};

export function Logo({ variant = 'full', size = 'md', className = '' }: LogoProps) {
  if (variant === 'full') {
    return (
      <img 
        src={logoImage} 
        alt="Well-Tailored" 
        className={`${sizeMap[size]} ${className}`}
      />
    );
  }

  if (variant === 'icon') {
    // Icon variant uses just the logo mark from the image (cropped to square)
    return (
      <div className={`${sizeMap[size]} aspect-square overflow-hidden flex items-center justify-center ${className}`}>
        <img 
          src={logoImage} 
          alt="Well-Tailored Icon" 
          className="h-full w-auto object-contain"
          style={{ objectPosition: 'left center' }}
        />
      </div>
    );
  }

  // Wordmark variant
  return (
    <div className={`${className}`}>
      <span 
        className="text-foreground" 
        style={{ 
          fontFamily: 'Manrope, sans-serif',
          fontSize: size === 'sm' ? '1.25rem' : size === 'md' ? '1.75rem' : size === 'lg' ? '2.5rem' : '3.5rem',
          fontWeight: 700,
          letterSpacing: '-0.02em'
        }}
      >
        Well-Tailored
      </span>
    </div>
  );
}

// Monogram component
export function Monogram({ size = 'md', className = '' }: Pick<LogoProps, 'size' | 'className'>) {
  return (
    <div 
      className={`${sizeMap[size]} aspect-square flex items-center justify-center bg-primary rounded ${className}`}
    >
      <span 
        className="text-primary-foreground"
        style={{ 
          fontFamily: 'Manrope, sans-serif',
          fontSize: size === 'sm' ? '0.75rem' : size === 'md' ? '1.25rem' : size === 'lg' ? '2rem' : '3rem',
          fontWeight: 700,
          letterSpacing: '-0.02em'
        }}
      >
        WT
      </span>
    </div>
  );
}