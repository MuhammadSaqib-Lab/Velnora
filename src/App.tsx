import { Suspense, lazy } from 'react'
import { HelmetProvider } from 'react-helmet-async'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { MotionProvider } from '@/components/MotionProvider'
import { FloatingChatWidget } from '@/components/chat/FloatingChatWidget'
import { Footer } from '@/components/layout/Footer'
import { AI_ASSISTANT_ENABLED } from '@/config/features'
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
// Client Portal: sign up / log in, submit a project, follow its status.
// Lazy-loaded like the admin area so the public homepage never pays for it.
const ClientLogin = lazy(() => import('@/pages/client/ClientLogin').then((m) => ({ default: m.ClientLogin })))
const ClientSignup = lazy(() => import('@/pages/client/ClientSignup').then((m) => ({ default: m.ClientSignup })))
const ClientShell = lazy(() => import('@/pages/client/ClientShell').then((m) => ({ default: m.ClientShell })))
const ClientProjects = lazy(() => import('@/pages/client/ClientProjects').then((m) => ({ default: m.ClientProjects })))
const NewProject = lazy(() => import('@/pages/client/NewProject').then((m) => ({ default: m.NewProject })))
const ClientProjectDetail = lazy(() =>
  import('@/pages/client/ClientProjectDetail').then((m) => ({ default: m.ClientProjectDetail })),
)
const AdminProjects = lazy(() => import('@/pages/internal/admin/Projects').then((m) => ({ default: m.Projects })))
const AdminProjectDetail = lazy(() =>
  import('@/pages/internal/admin/ProjectDetail').then((m) => ({ default: m.ProjectDetail })),
)
const AgentSettings = lazy(() => import('@/pages/internal/admin/AgentSettings').then((m) => ({ default: m.AgentSettings })))
// Digital Marketing workspace (Admin Dashboard). Each page is its own chunk.
const MarketingLayout = lazy(() => import('@/pages/internal/admin/marketing/MarketingLayout').then((m) => ({ default: m.MarketingLayout })))
const MarketingOverview = lazy(() => import('@/pages/internal/admin/marketing/MarketingOverview').then((m) => ({ default: m.MarketingOverview })))
const SeoWorkspace = lazy(() => import('@/pages/internal/admin/marketing/SeoWorkspace').then((m) => ({ default: m.SeoWorkspace })))
const SocialStudio = lazy(() => import('@/pages/internal/admin/marketing/SocialStudio').then((m) => ({ default: m.SocialStudio })))
const MarketingStrategies = lazy(() => import('@/pages/internal/admin/marketing/MarketingStrategies').then((m) => ({ default: m.MarketingStrategies })))
const CampaignPlanner = lazy(() => import('@/pages/internal/admin/marketing/CampaignPlanner').then((m) => ({ default: m.CampaignPlanner })))
const ClientAcquisition = lazy(() => import('@/pages/internal/admin/marketing/ClientAcquisition').then((m) => ({ default: m.ClientAcquisition })))
const MarketingRules = lazy(() => import('@/pages/internal/admin/marketing/MarketingRules').then((m) => ({ default: m.MarketingRules })))
const MarketingIntegrations = lazy(() => import('@/pages/internal/admin/marketing/MarketingIntegrations').then((m) => ({ default: m.MarketingIntegrations })))
const MarketingTasks = lazy(() => import('@/pages/internal/admin/marketing/MarketingTasks').then((m) => ({ default: m.MarketingTasks })))
const MarketingSettings = lazy(() => import('@/pages/internal/admin/marketing/MarketingSettings').then((m) => ({ default: m.MarketingSettings })))
// AI Assistant: TEMPORARILY DISABLED (src/config/features.ts). When off, the
// lazy import is never created, so the page and its heavy 3D/voice code are
// never requested; the implementation itself is kept for the future phase.
const AiAssistant = AI_ASSISTANT_ENABLED
  ? lazy(() => import('@/pages/internal/admin/AiAssistant').then((m) => ({ default: m.AiAssistant })))
  : null

function PublicChrome({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  // The client portal and its login/sign-up pages bring their own frame, so
  // they get none of the marketing site's navbar/footer/chat widget either.
  const isInternal =
    pathname.startsWith('/internal') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/client') ||
    pathname === '/login' ||
    pathname === '/signup'

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
        <MotionProvider>
        <BrowserRouter>
          <div className="noise-overlay" aria-hidden="true" />
          <PublicChrome>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route
                path="/login"
                element={
                  <Suspense fallback={null}>
                    <ClientLogin />
                  </Suspense>
                }
              />
              <Route
                path="/signup"
                element={
                  <Suspense fallback={null}>
                    <ClientSignup />
                  </Suspense>
                }
              />
              <Route
                path="/client"
                element={
                  <Suspense fallback={null}>
                    <ClientShell />
                  </Suspense>
                }
              >
                <Route index element={<Navigate to="/client/projects" replace />} />
                <Route path="projects" element={<ClientProjects />} />
                <Route path="projects/new" element={<NewProject />} />
                <Route path="projects/:id" element={<ClientProjectDetail />} />
              </Route>
              <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
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
                <Route path="projects" element={<AdminProjects />} />
                <Route path="projects/:id" element={<AdminProjectDetail />} />
                <Route path="agent-settings" element={<AgentSettings />} />
                <Route path="marketing" element={<MarketingLayout />}>
                  <Route index element={<MarketingOverview />} />
                  <Route path="seo" element={<SeoWorkspace />} />
                  <Route path="social" element={<SocialStudio />} />
                  <Route path="strategy" element={<MarketingStrategies />} />
                  <Route path="campaigns" element={<CampaignPlanner />} />
                  <Route path="acquisition" element={<ClientAcquisition />} />
                  <Route path="rules" element={<MarketingRules />} />
                  <Route path="integrations" element={<MarketingIntegrations />} />
                  <Route path="tasks" element={<MarketingTasks />} />
                  <Route path="settings" element={<MarketingSettings />} />
                  <Route path="*" element={<Navigate to="/internal/admin/marketing" replace />} />
                </Route>
                {AiAssistant ? (
                  <Route path="ai-assistant" element={<AiAssistant />} />
                ) : (
                  // Disabled: an old bookmark lands on the dashboard instead of a dead page.
                  <Route path="ai-assistant" element={<Navigate to="/internal/admin" replace />} />
                )}
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </PublicChrome>
        </BrowserRouter>
        </MotionProvider>
      </HelmetProvider>
    </ErrorBoundary>
  )
}
