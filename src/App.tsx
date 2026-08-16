import { Route, Routes } from 'react-router-dom'
import { Layout } from './app/components/Layout'
import { HomePage } from './app/pages/HomePage'
import { PlayPage } from './app/pages/PlayPage'
import { ResultPage } from './app/pages/ResultPage'
import { EditorListPage } from './app/pages/EditorListPage'
import { EditorPage } from './app/pages/EditorPage'
import { SettingsPage } from './app/pages/SettingsPage'
import { RulesPage } from './app/pages/RulesPage'

export default function App() {
  return (
    <Routes>
      {/* プレイ画面はヘッダー無しの全画面 */}
      <Route path="/play/:setId/:ruleId" element={<PlayPage />} />
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="/result" element={<ResultPage />} />
        <Route path="/editor" element={<EditorListPage />} />
        <Route path="/editor/:setId" element={<EditorPage />} />
        <Route path="/rules" element={<RulesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}
