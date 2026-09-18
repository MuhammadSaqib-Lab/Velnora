import { Suspense, lazy } from 'react'
import { HelmetProvider } from 'react-helmet-async'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { FloatingChatWidget } from '@/components/chat/FloatingChatWidget'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { Home } from '@/pages/Home'
import { NotFound } from '@/pages/NotFound'

// Lazy-loaded: these are internal-only interfaces (Phase 4's Lead Finder
// test page, Phase 5's Admin Dashboard and its login page), not part of
// the public marketing site. Code-splitting keeps their bundles out of
// the public homepage's initial load entirely — nobody visiting
// velnora.com pays for them unless they navigate to /admin or /internal/*.
const AdminLogin = lazy(() => import('@/pages/AdminLogin').then((m) => ({ default: m.AdminLogin })))
const LeadFinder = lazy(() =>
  import('@/pages/internal/LeadFinder').then((module) => ({ default: module.LeadFinder })),
)
const AdminShell = lazy(() =>
  import('@/pages/internal/admin/AdminShell').then((module) => ({ default: module.AdminShell })),
)
const Overview = lazy(() => import('@/pages/internal/admin/Overview').then((m) => ({ default: m.Overview })))
const ClientLeads = lazy(() => import('@/pages/internal/admin/ClientLeads').then((m) => ({ default: m.ClientLeads })))
const ClientLeadDetail = lazy(() =>
  import('@/pages/internal/admin/ClientLeadDetail').then((m) => ({ default: m.ClientLeadDetail })),
)
const LeadFinderLeads = lazy(() =>
  import('@/pages/internal/admin/LeadFinderLeads').then((m) => ({ default: m.LeadFinderLeads })),
)
const LeadFinderLeadDetail = lazy(() =>
  import('@/pages/internal/admin/LeadFinderLeadDetail').then((m) => ({ default: m.LeadFinderLeadDetail })),
)
const AdminReviews = lazy(() => import('@/pages/internal/admin/Reviews').then((m) => ({ default: m.Reviews })))

function PublicChrome({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const isInternal = pathname.startsWith('/internal') || pathname.startsWith('/admin')

  if (isInternal) return <main>{children}</main>

  return (
    <>
      <Navbar />
      <main>{children}</main>
      <Footer />
      <FloatingChatWidget />
    </>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <HelmetProvider>
        <BrowserRouter>
          <div className="noise-overlay" aria-hidden="true" />
          <PublicChrome>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route
                path="/admin/login"
                element={
                  <Suspense fallback={null}>
                    <AdminLogin />
                  </Suspense>
                }
              />
              <Route
                path="/internal/lead-finder"
                element={
                  <Suspense fallback={null}>
                    <LeadFinder />
                  </Suspense>
                }
              />
              <Route
                path="/internal/admin"
                element={
                  <Suspense fallback={null}>
                    <AdminShell />
                  </Suspense>
                }
              >
                <Route index element={<Overview />} />
                <Route path="client-leads" element={<ClientLeads />} />
                <Route path="client-leads/:id" element={<ClientLeadDetail />} />
                <Route path="lead-finder" element={<LeadFinderLeads />} />
                <Route path="lead-finder/:id" element={<LeadFinderLeadDetail />} />
                <Route path="reviews" element={<AdminReviews />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </PublicChrome>
        </BrowserRouter>
      </HelmetProvider>
    </ErrorBoundary>
  )
}
