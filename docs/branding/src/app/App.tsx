import { useState, useEffect } from 'react';
import { Logo, Monogram } from './components/Logo';
import { ColorPalette } from './components/ColorPalette';
import { TypographyShowcase } from './components/TypographyShowcase';
import { ButtonShowcase } from './components/BrandedButton';
import { CardShowcase } from './components/BrandedCard';
import { InputShowcase } from './components/BrandedInput';
import { BadgeShowcase } from './components/BrandedBadge';
import { SectionHeader } from './components/SectionHeader';
import { Moon, Sun } from 'lucide-react';

export default function App() {
  const [activeSection, setActiveSection] = useState('overview');
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const sections = [
    { id: 'overview', label: 'Overview' },
    { id: 'logos', label: 'Logos & Marks' },
    { id: 'colors', label: 'Colors' },
    { id: 'typography', label: 'Typography' },
    { id: 'buttons', label: 'Buttons' },
    { id: 'cards', label: 'Cards' },
    { id: 'inputs', label: 'Forms' },
    { id: 'badges', label: 'Badges' },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo variant="full" size="md" />
          <div className="flex items-center gap-4">
            <nav className="flex gap-1">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                    activeSection === section.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                  style={{ 
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 600,
                    fontSize: '0.875rem'
                  }}
                >
                  {section.label}
                </button>
              ))}
            </nav>
            <button
              onClick={() => setIsDark(!isDark)}
              className="p-2 rounded-lg bg-secondary hover:bg-accent transition-colors"
              aria-label="Toggle dark mode"
            >
              {isDark ? (
                <Sun className="w-5 h-5 text-foreground" />
              ) : (
                <Moon className="w-5 h-5 text-foreground" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {activeSection === 'overview' && (
          <div className="space-y-12">
            <div className="text-center space-y-4">
              <h1 
                className="m-0 text-foreground"
                style={{ 
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 700,
                  fontSize: '3.5rem',
                  lineHeight: 1.1
                }}
              >
                Well-Tailored
              </h1>
              <p 
                className="m-0 max-w-2xl mx-auto text-muted-foreground"
                style={{ 
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '1.25rem',
                  lineHeight: 1.6
                }}
              >
                A polished, modern brand identity system for creating better-fit job applications without sounding generic or artificial.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-card rounded-lg border border-border p-6 space-y-3">
                <h3 
                  className="m-0 text-card-foreground"
                  style={{ 
                    fontFamily: 'Manrope, sans-serif',
                    fontWeight: 600,
                    fontSize: '1.375rem'
                  }}
                >
                  Positioning
                </h3>
                <p 
                  className="m-0 text-muted-foreground"
                  style={{ 
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '1rem',
                    lineHeight: 1.6
                  }}
                >
                  A polished, modern tool that helps people create better-fit job applications without sounding generic or artificial.
                </p>
              </div>

              <div className="bg-card rounded-lg border border-border p-6 space-y-3">
                <h3 
                  className="m-0 text-card-foreground"
                  style={{ 
                    fontFamily: 'Manrope, sans-serif',
                    fontWeight: 600,
                    fontSize: '1.375rem'
                  }}
                >
                  Personality
                </h3>
                <p 
                  className="m-0 text-muted-foreground"
                  style={{ 
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '1rem',
                    lineHeight: 1.6
                  }}
                >
                  Polished, modern, calm, premium, credible. Sharp without being stiff.
                </p>
              </div>

              <div className="bg-card rounded-lg border border-border p-6 space-y-3">
                <h3 
                  className="m-0 text-card-foreground"
                  style={{ 
                    fontFamily: 'Manrope, sans-serif',
                    fontWeight: 600,
                    fontSize: '1.375rem'
                  }}
                >
                  Avoid
                </h3>
                <ul 
                  className="m-0 list-disc list-inside space-y-1 text-muted-foreground"
                  style={{ 
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '0.875rem',
                    lineHeight: 1.5
                  }}
                >
                  <li>Gimmicky AI aesthetics</li>
                  <li>Loud startup palettes</li>
                  <li>Corporate stiffness</li>
                  <li>Generic HR SaaS</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'logos' && (
          <div className="space-y-8">
            <SectionHeader 
              title="Logos & Marks"
              description="Primary brand marks and logo variations"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-card rounded-lg border border-border p-12 flex flex-col items-center justify-center space-y-4">
                <Logo variant="full" size="xl" />
                <p className="m-0 text-muted-foreground" style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem' }}>
                  Full Logo
                </p>
              </div>

              <div className="bg-card rounded-lg border border-border p-12 flex flex-col items-center justify-center space-y-4">
                <Logo variant="wordmark" size="lg" />
                <p className="m-0 text-muted-foreground" style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem' }}>
                  Wordmark
                </p>
              </div>

              <div className="bg-card rounded-lg border border-border p-12 flex flex-col items-center justify-center space-y-4">
                <Monogram size="xl" />
                <p className="m-0 text-muted-foreground" style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem' }}>
                  Monogram (WT)
                </p>
              </div>

              <div className="bg-card rounded-lg border border-border p-12 flex flex-col items-center justify-center space-y-4">
                <Logo variant="icon" size="xl" />
                <p className="m-0 text-muted-foreground" style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem' }}>
                  Icon Mark
                </p>
              </div>
            </div>

            <div className="bg-card rounded-lg border border-border p-6">
              <h4 className="m-0 mb-4 text-card-foreground" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
                Size Variations
              </h4>
              <div className="flex flex-wrap items-end gap-8">
                <div className="flex flex-col items-center gap-2">
                  <Monogram size="sm" />
                  <span className="text-muted-foreground" style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem' }}>Small</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Monogram size="md" />
                  <span className="text-muted-foreground" style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem' }}>Medium</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Monogram size="lg" />
                  <span className="text-muted-foreground" style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem' }}>Large</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Monogram size="xl" />
                  <span className="text-muted-foreground" style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem' }}>X-Large</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'colors' && (
          <div className="space-y-8">
            <SectionHeader 
              title="Color System"
              description="Primary brand colors and their usage guidelines"
            />
            <ColorPalette isDark={isDark} />
          </div>
        )}

        {activeSection === 'typography' && (
          <div className="space-y-8">
            <SectionHeader 
              title="Typography"
              description="Manrope for headings, Inter for body text"
            />
            <TypographyShowcase />
          </div>
        )}

        {activeSection === 'buttons' && (
          <div className="space-y-8">
            <SectionHeader 
              title="Buttons"
              description="Button components with various styles and states"
            />
            <ButtonShowcase />
          </div>
        )}

        {activeSection === 'cards' && (
          <div className="space-y-8">
            <SectionHeader 
              title="Cards"
              description="Card components for content organization"
            />
            <CardShowcase />
          </div>
        )}

        {activeSection === 'inputs' && (
          <div className="space-y-8">
            <SectionHeader 
              title="Form Elements"
              description="Input fields and form components"
            />
            <InputShowcase />
          </div>
        )}

        {activeSection === 'badges' && (
          <div className="space-y-8">
            <SectionHeader 
              title="Badges & Labels"
              description="Status indicators and label components"
            />
            <BadgeShowcase />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-24">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <Logo variant="wordmark" size="sm" />
            <p 
              className="m-0 text-muted-foreground"
              style={{ 
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.875rem'
              }}
            >
              Well-Tailored Brand Component Library
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}