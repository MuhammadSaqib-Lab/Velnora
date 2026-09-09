import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { NAV_CTA_LABEL, navItems } from '@/data/nav'

interface MobileMenuProps {
  open: boolean
  onClose: () => void
}

export function MobileMenu({ open, onClose }: MobileMenuProps) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-x-0 top-[72px] bottom-0 z-40 bg-[var(--color-canvas)]/98 backdrop-blur-xl lg:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <nav
            aria-label="Mobile"
            className="container-app flex h-full flex-col justify-between py-8"
          >
            <ul className="flex flex-col">
              {navItems.map((item, i) => (
                <motion.li
                  key={item.href}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.05 * i, ease: [0.16, 1, 0.3, 1] }}
                >
                  <a
                    href={item.href}
                    onClick={onClose}
                    className="block border-b border-white/[0.06] py-4 text-2xl font-medium text-[var(--color-ink)]"
                  >
                    {item.label}
                  </a>
                </motion.li>
              ))}
            </ul>
            <Button href="#contact" size="lg" className="w-full" onClick={onClose}>
              {NAV_CTA_LABEL}
            </Button>
          </nav>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
