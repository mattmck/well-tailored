export function TypographyShowcase() {
  return (
    <div className="space-y-8">
      {/* Headings */}
      <div className="space-y-4">
        <div className="bg-card rounded-lg border border-border p-6">
          <h1 
            className="m-0 text-foreground"
            style={{ 
              fontFamily: 'Manrope, sans-serif', 
              fontWeight: 700, 
              fontSize: '3rem',
              lineHeight: 1.2
            }}
          >
            Heading 1 - 48px Bold
          </h1>
          <p className="text-sm mt-2 text-muted-foreground" style={{ fontFamily: 'Inter, sans-serif' }}>
            Manrope 700
          </p>
        </div>

        <div className="bg-card rounded-lg border border-border p-6">
          <h2 
            className="m-0 text-foreground"
            style={{ 
              fontFamily: 'Manrope, sans-serif', 
              fontWeight: 700, 
              fontSize: '2.25rem',
              lineHeight: 1.2
            }}
          >
            Heading 2 - 36px Bold
          </h2>
          <p className="text-sm mt-2 text-muted-foreground" style={{ fontFamily: 'Inter, sans-serif' }}>
            Manrope 700
          </p>
        </div>

        <div className="bg-card rounded-lg border border-border p-6">
          <h3 
            className="m-0 text-foreground"
            style={{ 
              fontFamily: 'Manrope, sans-serif', 
              fontWeight: 600, 
              fontSize: '1.75rem',
              lineHeight: 1.3
            }}
          >
            Heading 3 - 28px Semibold
          </h3>
          <p className="text-sm mt-2 text-muted-foreground" style={{ fontFamily: 'Inter, sans-serif' }}>
            Manrope 600
          </p>
        </div>

        <div className="bg-card rounded-lg border border-border p-6">
          <h4 
            className="m-0 text-foreground"
            style={{ 
              fontFamily: 'Manrope, sans-serif', 
              fontWeight: 600, 
              fontSize: '1.375rem',
              lineHeight: 1.4
            }}
          >
            Heading 4 - 22px Semibold
          </h4>
          <p className="text-sm mt-2 text-muted-foreground" style={{ fontFamily: 'Inter, sans-serif' }}>
            Manrope 600
          </p>
        </div>
      </div>

      {/* Body Text */}
      <div className="space-y-4">
        <div className="bg-card rounded-lg border border-border p-6">
          <p 
            className="m-0 text-foreground"
            style={{ 
              fontFamily: 'Inter, sans-serif', 
              fontWeight: 400, 
              fontSize: '1.125rem',
              lineHeight: 1.6
            }}
          >
            Body Large - 18px Regular
          </p>
          <p className="text-sm mt-2 text-muted-foreground" style={{ fontFamily: 'Inter, sans-serif' }}>
            Inter 400 - Used for important body text and introductions
          </p>
        </div>

        <div className="bg-card rounded-lg border border-border p-6">
          <p 
            className="m-0 text-foreground"
            style={{ 
              fontFamily: 'Inter, sans-serif', 
              fontWeight: 400, 
              fontSize: '1rem',
              lineHeight: 1.6
            }}
          >
            Body - 16px Regular
          </p>
          <p className="text-sm mt-2 text-muted-foreground" style={{ fontFamily: 'Inter, sans-serif' }}>
            Inter 400 - Standard body text
          </p>
        </div>

        <div className="bg-card rounded-lg border border-border p-6">
          <p 
            className="m-0 text-muted-foreground"
            style={{ 
              fontFamily: 'Inter, sans-serif', 
              fontWeight: 400, 
              fontSize: '0.875rem',
              lineHeight: 1.5
            }}
          >
            Small / Muted - 14px Regular
          </p>
          <p className="text-sm mt-2 text-muted-foreground" style={{ fontFamily: 'Inter, sans-serif' }}>
            Inter 400 - Captions, metadata, secondary information
          </p>
        </div>

        <div className="bg-card rounded-lg border border-border p-6">
          <p 
            className="m-0 text-foreground"
            style={{ 
              fontFamily: 'Inter, sans-serif', 
              fontWeight: 600, 
              fontSize: '0.875rem',
              lineHeight: 1.5,
              letterSpacing: '0.01em'
            }}
          >
            BUTTON / LABEL - 14PX SEMIBOLD
          </p>
          <p className="text-sm mt-2 text-muted-foreground" style={{ fontFamily: 'Inter, sans-serif' }}>
            Inter 600 - Buttons, labels, navigation
          </p>
        </div>
      </div>
    </div>
  );
}