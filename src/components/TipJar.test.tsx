// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { render } from '../test-render'
import { TipJar, WIDGET_SCRIPT } from './TipJar'

const draw = vi.fn()

const scripts = () => [...document.querySelectorAll(`script[src="${WIDGET_SCRIPT}"]`)]

/** The CDN answers: from here on the widget's own API is on the window. */
const widgetArrives = () => {
  window.kofiWidgetOverlay = { draw }
  for (const script of scripts()) script.dispatchEvent(new Event('load'))
}

const host = () => document.querySelector('.tip-jar')

beforeEach(() => {
  draw.mockClear()
})

afterEach(() => {
  for (const script of scripts()) script.remove()
  delete window.kofiWidgetOverlay
})

describe('TipJar', () => {
  /**
   * The wall is a page with one thing to do on it. A second call — for money,
   * at that — before the first has been answered is a second call.
   */
  it('asks for nothing while the door is up', () => {
    render(<TipJar shown={false} theme="system" />)

    expect(scripts()).toHaveLength(0)
    expect(draw).not.toHaveBeenCalled()
  })

  it('fetches the widget once the door is behind', () => {
    render(<TipJar shown theme="system" />)

    expect(scripts()).toHaveLength(1)
  })

  it('draws the Ko-fi page it belongs to, into its own host', async () => {
    render(<TipJar shown theme="system" />)
    widgetArrives()

    await waitFor(() => expect(draw).toHaveBeenCalledTimes(1))
    expect(draw.mock.calls[0][0]).toBe('merkur')
    expect(draw.mock.calls[0][2]).toBe('tip-jar-widget')
  })

  // The catalogue's, like every other word on screen.
  it('labels the button in the reader‘s language', async () => {
    render(<TipJar shown theme="system" />)
    widgetArrives()

    await waitFor(() => expect(draw).toHaveBeenCalled())
    expect(draw.mock.calls[0][1]['floating-chat.donateButton.text']).toBe('Me soutenir')
  })

  /**
   * The widget loads a Google font of its own, which the button no longer
   * uses: the page dresses it in its own. A third-party request on every load,
   * for a face nothing renders.
   */
  it('declines the font the widget would fetch on its own', async () => {
    render(<TipJar shown theme="system" />)
    widgetArrives()

    await waitFor(() => expect(draw).toHaveBeenCalled())
    expect(draw.mock.calls[0][1]['floating-chat.stylesheets']).toBe('[]')
  })

  it('draws once, whatever the renders that follow', async () => {
    const { rerender } = render(<TipJar shown theme="system" />)
    widgetArrives()

    await waitFor(() => expect(draw).toHaveBeenCalledTimes(1))
    rerender(<TipJar shown theme="dark" />)

    expect(draw).toHaveBeenCalledTimes(1)
    expect(scripts()).toHaveLength(1)
  })

  /**
   * Connecting then disconnecting without searching puts the wall back. What
   * is drawn stays drawn — taking the widget down means leaving its frames
   * polling for a document that no longer exists — and the page hides it.
   */
  it('hides rather than unmakes itself when the door comes back', async () => {
    const { rerender } = render(<TipJar shown theme="system" />)
    widgetArrives()

    await waitFor(() => expect(draw).toHaveBeenCalled())
    rerender(<TipJar shown={false} theme="system" />)

    expect(host()).toHaveAttribute('hidden')
    expect(draw).toHaveBeenCalledTimes(1)
  })

  // The probe the frames are dressed from: it has to survive the widget, which
  // takes over the whole of the element it is handed.
  it('keeps its probe out of what the widget overwrites', () => {
    render(<TipJar shown theme="system" />)

    const probe = document.querySelector('.tip-jar-skin')
    expect(probe).not.toBeNull()
    expect(document.getElementById('tip-jar-widget')!.contains(probe)).toBe(false)
  })

  it('says nothing to a screen reader through its probe', () => {
    render(<TipJar shown theme="system" />)

    expect(document.querySelector('.tip-jar-skin')).toHaveAttribute('aria-hidden', 'true')
  })

  it('survives a CDN that never answers', async () => {
    render(<TipJar shown theme="system" />)

    for (const script of scripts()) script.dispatchEvent(new Event('error'))

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(draw).not.toHaveBeenCalled()
  })
})
