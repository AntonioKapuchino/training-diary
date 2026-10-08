import { createHashRouter, Navigate } from 'react-router'
import { ExerciseDetailPage } from '@/features/exercises/ExerciseDetailPage'
import { ExercisesPage } from '@/features/exercises/ExercisesPage'
import { HistoryPage } from '@/features/history/HistoryPage'
import { WorkoutDetailPage } from '@/features/history/WorkoutDetailPage'
import { WorkoutEditPage } from '@/features/history/WorkoutEditPage'
import { BodyPage } from '@/features/progress/BodyPage'
import { MonthPage } from '@/features/progress/MonthPage'
import { ProgressPage } from '@/features/progress/ProgressPage'
import { DataPage } from '@/features/settings/DataPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { TemplateEditorPage } from '@/features/templates/TemplateEditorPage'
import { TemplatesPage } from '@/features/templates/TemplatesPage'
import { TodayPage } from '@/features/today/TodayPage'
import { Layout } from './Layout'

/**
 * Хеш-маршруты: GitHub Pages не умеет отдавать index.html на любой путь,
 * а приложению с домашнего экрана адрес всё равно не виден.
 */
export const router = createHashRouter([
  {
    Component: Layout,
    children: [
      { index: true, Component: TodayPage },
      { path: 'history', Component: HistoryPage },
      { path: 'history/:id', Component: WorkoutDetailPage },
      { path: 'history/:id/edit', Component: WorkoutEditPage },
      { path: 'progress', Component: ProgressPage },
      { path: 'progress/body', Component: BodyPage },
      { path: 'progress/month/:month', Component: MonthPage },
      { path: 'exercises', Component: ExercisesPage },
      { path: 'exercises/:id', Component: ExerciseDetailPage },
      { path: 'templates', Component: TemplatesPage },
      { path: 'templates/:id', Component: TemplateEditorPage },
      { path: 'settings', Component: SettingsPage },
      { path: 'settings/data', Component: DataPage },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
