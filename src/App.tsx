import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { ensurePersistentStorage } from './lib/storage'
import { InstallScreen } from './screens/InstallScreen'
import { NotFoundScreen } from './screens/NotFoundScreen'
import { ShelfScreen } from './screens/ShelfScreen'

const CompareScreen = lazy(() =>
  import('./screens/CompareScreen').then((module) => ({ default: module.CompareScreen })),
)
const CreateProjectScreen = lazy(() =>
  import('./screens/CreateProjectScreen').then((module) => ({ default: module.CreateProjectScreen })),
)
const HistoryScreen = lazy(() =>
  import('./screens/HistoryScreen').then((module) => ({ default: module.HistoryScreen })),
)
const NewObservationScreen = lazy(() =>
  import('./screens/NewObservationScreen').then((module) => ({
    default: module.NewObservationScreen,
  })),
)
const ProjectLayout = lazy(() =>
  import('./screens/ProjectLayout').then((module) => ({ default: module.ProjectLayout })),
)
const ProjectScreen = lazy(() =>
  import('./screens/ProjectScreen').then((module) => ({ default: module.ProjectScreen })),
)
const RemindersScreen = lazy(() =>
  import('./screens/RemindersScreen').then((module) => ({ default: module.RemindersScreen })),
)
const SettingsScreen = lazy(() =>
  import('./screens/SettingsScreen').then((module) => ({ default: module.SettingsScreen })),
)
const SummaryScreen = lazy(() =>
  import('./screens/SummaryScreen').then((module) => ({ default: module.SummaryScreen })),
)
const TemplatePickerScreen = lazy(() =>
  import('./screens/TemplatePickerScreen').then((module) => ({
    default: module.TemplatePickerScreen,
  })),
)
const TodayScreen = lazy(() =>
  import('./screens/TodayScreen').then((module) => ({ default: module.TodayScreen })),
)

function RouteFallback() {
  return (
    <div className="mx-auto max-w-4xl space-y-4" aria-busy="true">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-line" />
      <div className="h-4 w-96 max-w-full animate-pulse rounded bg-line" />
      <div className="h-44 animate-pulse rounded-2xl bg-line" />
    </div>
  )
}

export function App() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')

  useEffect(() => {
    void ensurePersistentStorage()
    const handleInstalled = () => {
      void ensurePersistentStorage(true)
    }
    window.addEventListener('appinstalled', handleInstalled)
    return () => window.removeEventListener('appinstalled', handleInstalled)
  }, [])

  return (
    <BrowserRouter basename={base || '/'}>
      <AppShell>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<ShelfScreen />} />
            <Route path="/today" element={<TodayScreen />} />
            <Route path="/new" element={<TemplatePickerScreen />} />
            <Route path="/new/:templateId" element={<CreateProjectScreen />} />
            <Route path="/install" element={<InstallScreen />} />
            <Route path="/p/:projectId" element={<ProjectLayout />}>
              <Route index element={<ProjectScreen />} />
              <Route path="add" element={<NewObservationScreen />} />
              <Route path="edit/:observationId" element={<NewObservationScreen />} />
              <Route path="history" element={<HistoryScreen />} />
              <Route path="compare" element={<CompareScreen />} />
              <Route path="reminders" element={<RemindersScreen />} />
              <Route path="summary" element={<SummaryScreen />} />
              <Route path="settings" element={<SettingsScreen />} />
            </Route>
            <Route path="*" element={<NotFoundScreen />} />
          </Routes>
        </Suspense>
      </AppShell>
    </BrowserRouter>
  )
}
