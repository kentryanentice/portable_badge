import { Link } from 'react-router-dom'
import { useTheme } from '../providers/ThemeProvider'

function Header() {
    const { theme, toggleTheme } = useTheme()

    return (
        <header className="site-header">
            <Link to="/auth" className="site-header__brand">
                <img src="/pictures/pbadge.webp" alt="" />
                Portable Badge
            </Link>
            <span className="theme-icon">
                <i  className={theme === 'light' ? 'bx bx-sun' : 'bx bxs-sun'} onClick={toggleTheme} />
            </span>
        </header>
    )
}

export default Header
