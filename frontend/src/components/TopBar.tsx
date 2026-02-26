import { useEffect, useState } from 'react'
import './TopBar.css'

type Theme = 'dark' | 'light'

export default function TopBar() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme') as Theme | null
    return saved ?? 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  return (
    <div className="topBar">
      <div className="logo">🔥 Sense</div>

      <div className="topActions">
        <button className="pillBtn">Rec</button>
        <button className="pillBtn">Film</button>

        <button className="pillBtn" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>
      </div>
    </div>
  )
}