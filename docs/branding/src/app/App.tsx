import { useState } from 'react';
import { Logo, Monogram } from './components/Logo';
import { ColorPalette } from './components/ColorPalette';
import { TypographyShowcase } from './components/TypographyShowcase';
import { ButtonShowcase } from './components/BrandedButton';
import { CardShowcase } from './components/BrandedCard';
import { InputShowcase } from './components/BrandedInput';
import { BadgeShowcase } from './components/BrandedBadge';

export default function App() {
  const [activeSection, setActiveSection] = useState('overview');

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
      <header className="bg-white border-b border-[#E3DDD2] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo variant="full" size="md" />
          <nav className="flex gap-1">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                  activeSection === section.id
                    ? 'bg-[#314A74] text-white'
                    : 'text-[#747986] hover:bg-[#F8F5EE] hover:text-[#2B2D33]'
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
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {activeSection === 'overview' && (
          <div className="space-y-12">
            <div className="text-center space-y-4">
              <h1 
                className="m-0"
                style={{ 
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 700,
                  fontSize: '3.5rem',
                  lineHeight: 1.1,
                  color: '#2B2D33'
                }}
              >
                Well-Tailored
              </h1>
              <p 
                className="m-0 max-w-2xl mx-auto"
                style={{ 
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '1.25rem',
                  lineHeight: 1.6,
                  color: '#747986'
                }}
              >
                A polished, modern brand identity system for creating better-fit job applications without sounding generic or artificial.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg border border-[#E3DDD2] p-6 space-y-3">
                <h3 
                  className="m-0"
                  style={{ 
                    fontFamily: 'Manrope, sans-serif',
                    fontWeight: 600,
                    fontSize: '1.375rem',
                    color: '#2B2D33'
                  }}
                >
                  Positioning
                </h3>
                <p 
                  className="m-0"
                  style={{ 
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '1rem',
                    lineHeight: 1.6,
                    color: '#747986'
                  }}
                >
                  A polished, modern tool that helps people create better-fit job applications without sounding generic or artificial.
                </p>
              </div>

              <div className="bg-white rounded-lg border border-[#E3DDD2] p-6 space-y-3">
                <h3 
                  className="m-0"
                  style={{ 
                    fontFamily: 'Manrope, sans-serif',
                    fontWeight: 600,
                    fontSize: '1.375rem',
                    color: '#2B2D33'
                  }}
                >
                  Personality
                </h3>
                <p 
                  className="m-0"
                  style={{ 
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '1rem',
                    lineHeight: 1.6,
                    color: '#747986'
                  }}
                >
                  Polished, modern, calm, premium, credible. Sharp without being stiff.
                </p>
              </div>

              <div className="bg-white rounded-lg border border-[#E3DDD2] p-6 space-y-3">
                <h3 
                  className="m-0"
                  style={{ 
                    fontFamily: 'Manrope, sans-serif',
                    fontWeight: 600,
                    fontSize: '1.375rem',
                    color: '#2B2D33'
                  }}
                >
                  Avoid
                </h3>
                <ul 
                  className="m-0 list-disc list-inside space-y-1"
                  style={{ 
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '0.875rem',
                    lineHeight: 1.5,
                    color: '#747986'
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
            <div>
              <h2 
                className="m-0 mb-2"
                style={{ 
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 700,
                  fontSize: '2.25rem',
                  color: '#2B2D33'
                }}
              >
                Logos & Marks
              </h2>
              <p 
                className="m-0"
                style={{ 
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '1rem',
                  color: '#747986'
                }}
              >
                Primary brand marks and logo variations
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg border border-[#E3DDD2] p-12 flex flex-col items-center justify-center space-y-4">
                <Logo variant="full" size="xl" />
                <p 
                  className="m-0"
                  style={{ 
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '0.875rem',
                    color: '#747986'
                  }}
                >
                  Full Logo
                </p>
              </div>

              <div className="bg-white rounded-lg border border-[#E3DDD2] p-12 flex flex-col items-center justify-center space-y-4">
                <Logo variant="wordmark" size="lg" />
                <p 
                  className="m-0"
                  style={{ 
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '0.875rem',
                    color: '#747986'
                  }}
                >
                  Wordmark
                </p>
              </div>

              <div className="bg-white rounded-lg border border-[#E3DDD2] p-12 flex flex-col items-center justify-center space-y-4">
                <Monogram size="xl" />
                <p 
                  className="m-0"
                  style={{ 
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '0.875rem',
                    color: '#747986'
                  }}
                >
                  Monogram (WT)
                </p>
              </div>

              <div className="bg-white rounded-lg border border-[#E3DDD2] p-12 flex flex-col items-center justify-center space-y-4">
                <Logo variant="icon" size="xl" />
                <p 
                  className="m-0"
                  style={{ 
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '0.875rem',
                    color: '#747986'
                  }}
                >
                  Icon Mark
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-[#E3DDD2] p-6">
              <h4 className="m-0 mb-4" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
                Size Variations
              </h4>
              <div className="flex flex-wrap items-end gap-8">
                <div className="flex flex-col items-center gap-2">
                  <Monogram size="sm" />
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: '#747986' }}>Small</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Monogram size="md" />
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: '#747986' }}>Medium</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Monogram size="lg" />
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: '#747986' }}>Large</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Monogram size="xl" />
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: '#747986' }}>X-Large</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'colors' && (
          <div className="space-y-8">
            <div>
              <h2 
                className="m-0 mb-2"
                style={{ 
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 700,
                  fontSize: '2.25rem',
                  color: '#2B2D33'
                }}
              >
                Color System
              </h2>
              <p 
                className="m-0"
                style={{ 
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '1rem',
                  color: '#747986'
                }}
              >
                Primary brand colors and their usage guidelines
              </p>
            </div>
            <ColorPalette />
          </div>
        )}

        {activeSection === 'typography' && (
          <div className="space-y-8">
            <div>
              <h2 
                className="m-0 mb-2"
                style={{ 
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 700,
                  fontSize: '2.25rem',
                  color: '#2B2D33'
                }}
              >
                Typography
              </h2>
              <p 
                className="m-0"
                style={{ 
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '1rem',
                  color: '#747986'
                }}
              >
                Manrope for headings, Inter for body text
              </p>
            </div>
            <TypographyShowcase />
          </div>
        )}

        {activeSection === 'buttons' && (
          <div className="space-y-8">
            <div>
              <h2 
                className="m-0 mb-2"
                style={{ 
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 700,
                  fontSize: '2.25rem',
                  color: '#2B2D33'
                }}
              >
                Buttons
              </h2>
              <p 
                className="m-0"
                style={{ 
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '1rem',
                  color: '#747986'
                }}
              >
                Button components with various styles and states
              </p>
            </div>
            <ButtonShowcase />
          </div>
        )}

        {activeSection === 'cards' && (
          <div className="space-y-8">
            <div>
              <h2 
                className="m-0 mb-2"
                style={{ 
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 700,
                  fontSize: '2.25rem',
                  color: '#2B2D33'
                }}
              >
                Cards
              </h2>
              <p 
                className="m-0"
                style={{ 
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '1rem',
                  color: '#747986'
                }}
              >
                Card components for content organization
              </p>
            </div>
            <CardShowcase />
          </div>
        )}

        {activeSection === 'inputs' && (
          <div className="space-y-8">
            <div>
              <h2 
                className="m-0 mb-2"
                style={{ 
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 700,
                  fontSize: '2.25rem',
                  color: '#2B2D33'
                }}
              >
                Form Elements
              </h2>
              <p 
                className="m-0"
                style={{ 
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '1rem',
                  color: '#747986'
                }}
              >
                Input fields and form components
              </p>
            </div>
            <InputShowcase />
          </div>
        )}

        {activeSection === 'badges' && (
          <div className="space-y-8">
            <div>
              <h2 
                className="m-0 mb-2"
                style={{ 
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 700,
                  fontSize: '2.25rem',
                  color: '#2B2D33'
                }}
              >
                Badges & Labels
              </h2>
              <p 
                className="m-0"
                style={{ 
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '1rem',
                  color: '#747986'
                }}
              >
                Status indicators and label components
              </p>
            </div>
            <BadgeShowcase />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E3DDD2] mt-24">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <Logo variant="wordmark" size="sm" />
            <p 
              className="m-0"
              style={{ 
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.875rem',
                color: '#747986'
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
