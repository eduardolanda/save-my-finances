import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream
const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIOSSteps, setShowIOSSteps] = useState(false)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('pwa-install-dismissed') === '1')

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // Hide when installed while the page is open
  useEffect(() => {
    const mq = window.matchMedia('(display-mode: standalone)')
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setDismissed(true)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDismissed(true)
      localStorage.setItem('pwa-install-dismissed', '1')
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem('pwa-install-dismissed', '1')
  }

  // Don't show if: already installed, dismissed, or no reason to prompt
  if (isStandalone || dismissed) return null
  if (!deferredPrompt && !isIOS) return null

  return (
    <>
      {/* Banner */}
      <div className="bg-indigo-950 border border-indigo-700 rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg">
        <span className="text-2xl shrink-0">📲</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-indigo-100">Install Save My Finances</p>
          <p className="text-xs text-indigo-300 mt-0.5">Works offline — access your data anytime from your home screen.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {deferredPrompt ? (
            <button
              onClick={handleInstall}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition"
            >
              Install
            </button>
          ) : (
            <button
              onClick={() => setShowIOSSteps(v => !v)}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition"
            >
              {showIOSSteps ? 'Hide' : 'How?'}
            </button>
          )}
          <button
            onClick={handleDismiss}
            aria-label="Dismiss install prompt"
            className="p-1 rounded-lg text-indigo-400 hover:text-indigo-200 hover:bg-indigo-900 transition text-base leading-none"
          >
            ✕
          </button>
        </div>
      </div>

      {/* iOS step-by-step instructions */}
      {isIOS && showIOSSteps && (
        <div className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-4">
          <p className="text-xs font-semibold text-slate-300 uppercase tracking-widest mb-3">How to install on iOS</p>
          <ol className="flex flex-col gap-2.5">
            {[
              { icon: '⬆️', text: 'Tap the Share button in Safari\'s toolbar (the box with an arrow pointing up).' },
              { icon: '⬇️', text: 'Scroll down in the Share sheet and tap "Add to Home Screen".' },
              { icon: '✏️', text: 'Optionally edit the name, then tap "Add" in the top-right corner.' },
              { icon: '🎉', text: 'Open the app from your home screen — it runs fullscreen and works offline!' },
            ].map(({ icon, text }, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-slate-300">
                <span className="shrink-0 w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-indigo-400">
                  {i + 1}
                </span>
                <span>
                  <span className="mr-1">{icon}</span>
                  {text}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  )
}
