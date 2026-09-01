import { useEffect, useRef, useState } from 'react'

import type { Theme } from '../domain/theme'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { useTranslation } from '../i18n/LocaleProvider'
import { furnish, readSkin } from './tipJarFrame'

/** The Ko-fi page the button opens. */
const HANDLE = 'merkur'

/** Their overlay widget, and the only third-party script the page runs. */
export const WIDGET_SCRIPT = 'https://storage.ko-fi.com/cdn/scripts/overlay-widget.js'

/**
 * Where the widget is told to draw itself. Handed as the third argument to
 * `draw`, which then keeps everything — frames and popup alike — inside it,
 * instead of appending it all to `<body>` where nothing the page owns could
 * reach it.
 */
const HOST_ID = 'tip-jar-widget'

declare global {
  interface Window {
    kofiWidgetOverlay?: {
      draw: (handle: string, config: Record<string, string>, containerId?: string) => void
    }
  }
}

/**
 * The widget's script, requested once and shared by whoever asks next.
 *
 * The guard is the document rather than a module variable: two mounts of the
 * same component — which is what `StrictMode` does in development — must not
 * put two copies of the same script in the head.
 */
function widget(): Promise<void> {
  if (window.kofiWidgetOverlay) return Promise.resolve()

  const existing = document.querySelector<HTMLScriptElement>(`script[src="${WIDGET_SCRIPT}"]`)
  const script = existing ?? document.createElement('script')

  const arrival = new Promise<void>((resolve, reject) => {
    script.addEventListener('load', () => resolve())
    script.addEventListener('error', () => reject(new Error('Ko-fi widget unavailable')))
  })

  if (!existing) {
    script.src = WIDGET_SCRIPT
    script.async = true
    document.head.append(script)
  }

  return arrival
}

export interface TipJarProps {
  /** Whether the reader is past the door. Nothing is fetched before they are. */
  shown: boolean
  /** Read as a signal only: a change of theme is a change of the frame's ink. */
  theme: Theme
}

/**
 * The tip jar, in the corner the way back up already stands in.
 *
 * Two things it does not do, and both are the point. It asks the CDN for
 * nothing while the wall is up: a page whose one job is to be let in has no
 * business also asking for money. And once drawn it is never taken down —
 * connecting then disconnecting without searching puts the wall back, and
 * unmounting the widget would leave its frames polling for a document that no
 * longer exists. The wall hides it instead.
 *
 * What is left to the widget is the popup it opens. What the page takes back is
 * where the button stands (`tip-jar.css`) and what it is made of
 * (`tipJarFrame.ts`) — a Ko-fi blue pill in the bottom-left corner would be a
 * stranger on the page, sitting on top of the readout.
 */
export function TipJar({ shown, theme }: TipJarProps) {
  const { t } = useTranslation()
  const label = t('tipJar.label')

  const probe = useRef<HTMLSpanElement>(null)
  const host = useRef<HTMLDivElement>(null)
  const asked = useRef(false)
  const [drawn, setDrawn] = useState(false)

  /* Not read, only depended upon: the frame's colours are the page's, and the
     page's change under both — the explicit choice, and the system's when no
     choice is made. */
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)')
  const dark = theme === 'dark' || (theme === 'system' && systemDark)

  useEffect(() => {
    if (!shown || asked.current) return
    asked.current = true

    widget()
      .then(() => {
        if (!host.current || !probe.current) return
        const skin = readSkin(probe.current)
        window.kofiWidgetOverlay?.draw(
          HANDLE,
          {
            type: 'floating-chat',
            'floating-chat.donateButton.text': label,
            /* The colours of the moment, and the frame's sheet keeps them up
               to date afterwards. They matter for the one frame the sheet
               might not reach — the widget's classes are its own, and they can
               change without the page hearing about it. */
            'floating-chat.donateButton.background-color': skin.fill,
            'floating-chat.donateButton.text-color': skin.ink,
            /* The widget fetches a Google font for a button that no longer
               uses it: the page dresses it in its own. */
            'floating-chat.stylesheets': '[]',
          },
          HOST_ID,
        )
        setDrawn(true)
      })
      /* A CDN that does not answer costs the page a button, and nothing else:
         there is no message to carry, because nothing was asked for. */
      .catch(() => {})
  }, [shown, label])

  useEffect(() => {
    if (!drawn || !host.current || !probe.current) return
    furnish(host.current, readSkin(probe.current), label)
  }, [drawn, dark, label])

  return (
    <div className="tip-jar" hidden={!shown}>
      {/* The page's own control, resolved, for `tipJarFrame.ts` to read back.
          Outside the host on purpose: the widget takes over the whole of the
          element it is handed, and would overwrite it on its first draw. */}
      <span className="tip-jar-skin" aria-hidden="true" ref={probe} />
      <div id={HOST_ID} ref={host} />
    </div>
  )
}
