interface SectionHeaderProps {
  title: string;
  description: string;
}

export function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <div>
      <h2 
        className="m-0 mb-2 text-foreground"
        style={{ 
          fontFamily: 'Manrope, sans-serif',
          fontWeight: 700,
          fontSize: '2.25rem'
        }}
      >
        {title}
      </h2>
      <p 
        className="m-0 text-muted-foreground"
        style={{ 
          fontFamily: 'Inter, sans-serif',
          fontSize: '1rem'
        }}
      >
        {description}
      </p>
    </div>
  );
}
