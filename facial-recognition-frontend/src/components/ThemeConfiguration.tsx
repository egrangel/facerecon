import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Theme } from '../types/theme';
import Button from './ui/Button';
import Input from './ui/Input';
import { Card, CardContent } from './ui/Card';

const ThemeConfiguration: React.FC = () => {
  const { theme, themes, setTheme, createCustomTheme } = useTheme();
  const [selectedTheme, setSelectedTheme] = useState(theme.id);
  const [showCustomTheme, setShowCustomTheme] = useState(false);
  const [customThemeForm, setCustomThemeForm] = useState({
    name: '',
    primaryColor: theme.colors.primary[500],
    secondaryColor: theme.colors.secondary[500],
    backgroundColor: theme.colors.background.primary,
    textColor: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.sans.join(', '),
  });

  const handleThemeSelect = (themeId: string) => {
    setSelectedTheme(themeId);
    setTheme(themeId);
  };

  const handleCustomThemeSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const customTheme: Partial<Theme> = {
      name: customThemeForm.name,
      colors: {
        ...theme.colors,
        primary: {
          ...theme.colors.primary,
          500: customThemeForm.primaryColor,
          600: adjustColorBrightness(customThemeForm.primaryColor, -20),
          700: adjustColorBrightness(customThemeForm.primaryColor, -40),
        },
        secondary: {
          ...theme.colors.secondary,
          500: customThemeForm.secondaryColor,
          600: adjustColorBrightness(customThemeForm.secondaryColor, -20),
          700: adjustColorBrightness(customThemeForm.secondaryColor, -40),
        },
        background: {
          ...theme.colors.background,
          primary: customThemeForm.backgroundColor,
        },
        text: {
          ...theme.colors.text,
          primary: customThemeForm.textColor,
        },
      },
      typography: {
        ...theme.typography,
        fontFamily: {
          ...theme.typography.fontFamily,
          sans: customThemeForm.fontFamily.split(',').map(font => font.trim()),
        },
      },
    };

    createCustomTheme(customTheme);
    setShowCustomTheme(false);
  };

  // Utility function to adjust color brightness
  const adjustColorBrightness = (color: string, percent: number): string => {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = ((num >> 8) & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-2">
          Configuração de Tema
        </h2>
        <p className="text-[var(--color-text-secondary)]">
          Personalize a aparência da aplicação escolhendo um tema ou criando um personalizado.
        </p>
      </div>

      {/* Predefined Themes */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-4">
            Temas Predefinidos
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {themes.map((themeOption) => (
              <div
                key={themeOption.id}
                className={`
                  relative p-4 rounded-lg border-2 cursor-pointer transition-all
                  ${selectedTheme === themeOption.id
                    ? 'border-[var(--color-primary-500)] bg-[var(--color-primary-50)]'
                    : 'border-[var(--color-border-light)] hover:border-[var(--color-border-medium)]'
                  }
                `}
                onClick={() => handleThemeSelect(themeOption.id)}
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-[var(--color-text-primary)]">
                    {themeOption.name}
                  </h4>
                  {selectedTheme === themeOption.id && (
                    <div className="w-5 h-5 rounded-full bg-[var(--color-primary-500)] flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Theme Preview */}
                <div className="space-y-2">
                  <div className="flex space-x-2">
                    <div
                      className="w-6 h-6 rounded"
                      style={{ backgroundColor: themeOption.colors.primary[500] }}
                    />
                    <div
                      className="w-6 h-6 rounded"
                      style={{ backgroundColor: themeOption.colors.secondary[500] }}
                    />
                    <div
                      className="w-6 h-6 rounded border"
                      style={{ backgroundColor: themeOption.colors.background.primary }}
                    />
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    Primary • Secondary • Background
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Custom Theme Creator */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4 mt-4">
            <h3 className="text-lg font-medium text-[var(--color-text-primary)]">
              Tema Personalizado
            </h3>
            <Button
              variant="outline"
              onClick={() => setShowCustomTheme(!showCustomTheme)}
            >
              {showCustomTheme ? 'Fechar' : 'Criar Tema'}
            </Button>
          </div>

          {showCustomTheme && (
            <form onSubmit={handleCustomThemeSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                    Nome do Tema
                  </label>
                  <Input
                    type="text"
                    value={customThemeForm.name}
                    onChange={(e) => setCustomThemeForm({ ...customThemeForm, name: e.target.value })}
                    placeholder="Meu Tema Personalizado"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                    Família da Fonte
                  </label>
                  <Input
                    type="text"
                    value={customThemeForm.fontFamily}
                    onChange={(e) => setCustomThemeForm({ ...customThemeForm, fontFamily: e.target.value })}
                    placeholder="Inter, Arial, sans-serif"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                    Cor Primária
                  </label>
                  <div className="flex space-x-2">
                    <Input
                      type="color"
                      value={customThemeForm.primaryColor}
                      onChange={(e) => setCustomThemeForm({ ...customThemeForm, primaryColor: e.target.value })}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      type="text"
                      value={customThemeForm.primaryColor}
                      onChange={(e) => setCustomThemeForm({ ...customThemeForm, primaryColor: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                    Cor Secundária
                  </label>
                  <div className="flex space-x-2">
                    <Input
                      type="color"
                      value={customThemeForm.secondaryColor}
                      onChange={(e) => setCustomThemeForm({ ...customThemeForm, secondaryColor: e.target.value })}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      type="text"
                      value={customThemeForm.secondaryColor}
                      onChange={(e) => setCustomThemeForm({ ...customThemeForm, secondaryColor: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                    Cor de Fundo
                  </label>
                  <div className="flex space-x-2">
                    <Input
                      type="color"
                      value={customThemeForm.backgroundColor}
                      onChange={(e) => setCustomThemeForm({ ...customThemeForm, backgroundColor: e.target.value })}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      type="text"
                      value={customThemeForm.backgroundColor}
                      onChange={(e) => setCustomThemeForm({ ...customThemeForm, backgroundColor: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                    Cor do Texto
                  </label>
                  <div className="flex space-x-2">
                    <Input
                      type="color"
                      value={customThemeForm.textColor}
                      onChange={(e) => setCustomThemeForm({ ...customThemeForm, textColor: e.target.value })}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      type="text"
                      value={customThemeForm.textColor}
                      onChange={(e) => setCustomThemeForm({ ...customThemeForm, textColor: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-[var(--color-border-light)]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCustomTheme(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit">
                  Criar e Aplicar Tema
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Live Preview */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-4">
            Visualização
          </h3>
          <div className="space-y-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
            <div>
              <h4 className="text-xl font-semibold text-[var(--color-text-primary)]">
                Título Principal
              </h4>
              <p className="text-[var(--color-text-secondary)] mt-2">
                Este é um texto secundário que mostra como a tipografia aparece com o tema atual.
              </p>
              <p className="text-[var(--color-text-muted)] text-sm mt-1">
                Texto com cor reduzida para informações menos importantes.
              </p>
            </div>

            <div className="flex space-x-3">
              <Button variant="primary">Botão Primário</Button>
              <Button variant="secondary">Botão Secundário</Button>
              <Button variant="outline">Botão Outline</Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded border" style={{
                backgroundColor: 'var(--color-status-success-bg)',
                color: 'var(--color-status-success-text)',
                borderColor: 'var(--color-status-success-border)'
              }}>
                ✓ Mensagem de Sucesso
              </div>
              <div className="p-3 rounded border" style={{
                backgroundColor: 'var(--color-status-warning-bg)',
                color: 'var(--color-status-warning-text)',
                borderColor: 'var(--color-status-warning-border)'
              }}>
                ⚠ Mensagem de Aviso
              </div>
            </div>

            <Input placeholder="Campo de entrada de exemplo" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ThemeConfiguration;