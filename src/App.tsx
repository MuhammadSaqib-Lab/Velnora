import { HelmetProvider } from 'react-helmet-async'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { FloatingChatWidget } from '@/components/chat/FloatingChatWidget'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { Home } from '@/pages/Home'

export default function App() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <div className="noise-overlay" aria-hidden="true" />
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
          </Routes>
        </main>
        <Footer />
        <FloatingChatWidget />
      </BrowserRouter>
    </HelmetProvider>
  )
}
