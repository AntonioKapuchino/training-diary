import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import Diary from './pages/Diary'
import WorkoutEditor from './pages/WorkoutEditor'
import Progress from './pages/Progress'
import Catalog from './pages/Catalog'
import Templates from './pages/Templates'
import { IconDiary, IconChart, IconDumbbell, IconTemplate } from './components/icons'

const TABS = [
  { to: '/', label: 'Дневник', Icon: IconDiary },
  { to: '/progress', label: 'Прогресс', Icon: IconChart },
  { to: '/catalog', label: 'Упражнения', Icon: IconDumbbell },
  { to: '/templates', label: 'Шаблоны', Icon: IconTemplate },
]

export default function App() {
  const { pathname } = useLocation()
  // Скрываем таб-бар на экране редактирования тренировки
  const hideTabs = pathname.startsWith('/workout/')

  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Diary />} />
        <Route path="/workout/:date" element={<WorkoutEditor />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/catalog" element={<Catalog />} />
        <Route path="/templates" element={<Templates />} />
      </Routes>

      {!hideTabs && (
        <nav className="tabbar">
          {TABS.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}
