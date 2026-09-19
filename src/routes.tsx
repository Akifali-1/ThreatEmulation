import { lazy } from 'react'
import { createBrowserRouter } from 'react-router'

import { AppShell } from './components/layout/AppShell'

/**
 * Routes are lazy so the first paint only ships the shell. Every page is a default export.
 * A single Suspense boundary inside AppShell handles all of them.
 */
const Overview = lazy(() => import('./pages/Overview'))
const LiveOperations = lazy(() => import('./pages/LiveOperations'))
const Trials = lazy(() => import('./pages/Trials'))
const Techniques = lazy(() => import('./pages/Techniques'))
const TechniqueDetail = lazy(() => import('./pages/TechniqueDetail'))
const Compare = lazy(() => import('./pages/Compare'))
const DetectionGaps = lazy(() => import('./pages/DetectionGaps'))
const BlueAgent = lazy(() => import('./pages/BlueAgent'))
const PipelineHealth = lazy(() => import('./pages/PipelineHealth'))
const Reports = lazy(() => import('./pages/Reports'))
const Methodology = lazy(() => import('./pages/Methodology'))
const NotFound = lazy(() => import('./pages/NotFound'))

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Overview /> },
      { path: 'live', element: <LiveOperations /> },
      { path: 'trials', element: <Trials /> },
      { path: 'techniques', element: <Techniques /> },
      { path: 'techniques/:technique', element: <TechniqueDetail /> },
      { path: 'compare', element: <Compare /> },
      { path: 'gaps', element: <DetectionGaps /> },
      { path: 'blue', element: <BlueAgent /> },
      { path: 'health', element: <PipelineHealth /> },
      { path: 'reports', element: <Reports /> },
      { path: 'methodology', element: <Methodology /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])
