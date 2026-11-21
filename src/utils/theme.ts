import { isDarkTheme, type Theme } from '@dash4/shared'

const KEY = 'dash4.theme'

/** Thème mémorisé sur ce navigateur (pour l'écran de connexion, avant de connaître le compte). */
export function storedTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY) ?? (localStorage.getItem('dash4.dark') === '1' ? 'dark' : null)
    return v === 'dark' || v === 'light' ? v : 'system'
  } catch {
    return 'system'
  }
}

const prefersDark = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches

/** Applique le thème (classe `app-dark` de PrimeVue) et le mémorise. */
export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('app-dark', isDarkTheme(theme, prefersDark()))
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // stockage indisponible : le thème suivra le compte à la prochaine connexion
  }
}

/** Thème opposé à celui affiché (bouton du menu). */
export function toggledTheme(current: Theme): Theme {
  return isDarkTheme(current, prefersDark()) ? 'light' : 'dark'
}
