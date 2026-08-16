import { NavLink, Outlet, Link } from 'react-router-dom'

export function Layout() {
  return (
    <>
      <header className="header">
        <Link to="/" className="brand">
          🎴 SDKかるた
        </Link>
        <nav>
          <NavLink to="/" end>
            あそぶ
          </NavLink>
          <NavLink to="/editor">札をつくる</NavLink>
          <NavLink to="/rules">ルール</NavLink>
          <NavLink to="/settings">設定</NavLink>
        </nav>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </>
  )
}
