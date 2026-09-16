import { Moon, Sun } from '@phosphor-icons/react';
import { useTheme } from '../theme/ThemeContext';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const next = theme === 'dark' ? 'claro' : 'escuro';

  return (
    <button
      type="button"
      className="btn btn-icon"
      onClick={toggle}
      aria-label={`Mudar para tema ${next}`}
      title={`Mudar para tema ${next}`}
    >
      {theme === 'dark' ? (
        <Sun size={18} aria-hidden="true" />
      ) : (
        <Moon size={18} aria-hidden="true" />
      )}
    </button>
  );
}
