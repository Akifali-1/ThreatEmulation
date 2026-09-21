import { lazy } from 'react'
import { createBrowserRouter } from 'react-router'

import { AppShell } from './components/layout/AppShell'
import { SocketProvider } from './context/SocketContext'

/**
 * Routes are lazy so the first paint only ships the shell. Every page is a default export.
 * A single Suspense boundary inside AppShell handles all of them.
 */
const Landing = lazy(() => import('./pages/Landing'))
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
    // The landing page renders outside the shell — no sidebar, no chrome. It's the cover.
    // It gets its own socket so the field can go live when a batch is running.
    path: '/',
    element: (
      <SocketProvider>
        <Landing />
      </SocketProvider>
    ),
  },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { path: 'overview', element: <Overview /> },
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
