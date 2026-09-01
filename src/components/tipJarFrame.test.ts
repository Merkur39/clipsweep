// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'

import { frameStyle, furnish, readSkin, type Skin } from './tipJarFrame'

/**
 * The page's answer, as the sheet leaves it on the probe: seven declarations
 * whose only job is to be read back. Literal values here — jsdom resolves
 * neither `var()` nor `light-dark()`, and what is under test is the mapping
 * from property to role, not the palette. That the sheet declares them on the
 * probe itself, and in tokens, is `scripts/geometry/tip-jar.test.ts`.
 */
const probe = () => {
  const span = document.createElement('span')
  span.style.color = 'rgb(1, 1, 1)'
  span.style.backgroundColor = 'rgb(2, 2, 2)'
  span.style.borderTopColor = 'rgb(3, 3, 3)'
  span.style.borderLeftColor = 'rgb(4, 4, 4)'
  span.style.borderBottomColor = 'rgb(5, 5, 5)'
  span.style.outlineColor = 'rgb(6, 6, 6)'
  span.style.fontFamily = 'Manrope, sans-serif'
  document.body.append(span)
  return span
}

const SKIN: Skin = {
  ink: 'rgb(1, 1, 1)',
  fill: 'rgb(2, 2, 2)',
  edge: 'rgb(3, 3, 3)',
  hoverFill: 'rgb(4, 4, 4)',
  hoverEdge: 'rgb(5, 5, 5)',
  ring: 'rgb(6, 6, 6)',
  font: 'Manrope, sans-serif',
}

/** A widget as Ko-fi leaves it: two frames, each holding the same button. */
const drawn = () => {
  const host = document.createElement('div')
  document.body.append(host)

  for (const className of ['floatingchat-container', 'floatingchat-container-mobi']) {
    const frame = document.createElement('iframe')
    frame.className = className
    host.append(frame)
    frame.contentDocument!.body.innerHTML =
      '<div class="floatingchat-donate-button"><img class="kofiimg"><span>Support me</span></div>'
  }

  return host
}

const frames = (host: HTMLElement) => [...host.querySelectorAll('iframe')]
const sheet = (frame: HTMLIFrameElement) =>
  frame.contentDocument!.getElementById('tip-jar-skin')?.textContent ?? ''
const button = (frame: HTMLIFrameElement) =>
  frame.contentDocument!.querySelector<HTMLElement>('.floatingchat-donate-button')!
const caption = (frame: HTMLIFrameElement) => button(frame).querySelector('span')?.textContent

afterEach(() => {
  document.body.innerHTML = ''
})

describe('readSkin', () => {
  it('reads the page‘s own control off the probe', () => {
    expect(readSkin(probe())).toEqual(SKIN)
  })
})

describe('frameStyle', () => {
  it('carries every colour it was given', () => {
    const css = frameStyle(SKIN)

    for (const value of Object.values(SKIN)) {
      expect(css).toContain(value)
    }
  })

  /**
   * The widget writes its own colours as inline styles on the button it
   * builds. A rule that does not insist is a rule that never applies.
   */
  it('insists, because what it overrides is an inline style', () => {
    expect(frameStyle(SKIN)).toContain('!important')
  })
})

describe('furnish', () => {
  it('dresses both frames of the widget', () => {
    const host = drawn()

    furnish(host, SKIN, 'Me soutenir')

    for (const frame of frames(host)) {
      expect(sheet(frame)).toContain(SKIN.fill)
    }
  })

  it('puts the button‘s wording in the reader‘s language', () => {
    const host = drawn()

    furnish(host, SKIN, 'Me soutenir')

    for (const frame of frames(host)) {
      expect(caption(frame)).toBe('Me soutenir')
    }
  })

  // A frame with no name is a frame a screen reader announces as "frame".
  it('names the frames it dresses', () => {
    const host = drawn()

    furnish(host, SKIN, 'Me soutenir')

    for (const frame of frames(host)) {
      expect(frame).toHaveAttribute('title', 'Me soutenir')
    }
  })

  /**
   * Called again on every change of theme: what it writes has to replace what
   * it wrote, not pile onto it.
   */
  it('rewrites its sheet rather than adding a second one', () => {
    const host = drawn()

    furnish(host, SKIN, 'Me soutenir')
    furnish(host, { ...SKIN, fill: 'rgb(9, 9, 9)' }, 'Me soutenir')

    for (const frame of frames(host)) {
      expect(frame.contentDocument!.querySelectorAll('#tip-jar-skin')).toHaveLength(1)
      expect(sheet(frame)).toContain('rgb(9, 9, 9)')
    }
  })

  // The widget is a third party, drawn asynchronously and from a CDN: a frame
  // that is not there yet, or not there at all, is not a crash.
  it('leaves alone what it cannot reach', () => {
    const host = document.createElement('div')
    host.innerHTML = '<iframe class="floatingchat-container"></iframe>'

    expect(() => furnish(host, SKIN, 'Me soutenir')).not.toThrow()
  })

  it('survives a frame whose button the CDN has renamed', () => {
    const host = drawn()
    for (const frame of frames(host)) frame.contentDocument!.body.innerHTML = '<div></div>'

    expect(() => furnish(host, SKIN, 'Me soutenir')).not.toThrow()
  })
})

/**
 * Ko-fi builds its button as a bare `<div>` with a click listener: nothing a
 * `Tab` reaches, nothing a screen reader announces. The page hands it back.
 */
describe('the button, to the keyboard', () => {
  it('says it is a button and takes its place in the tab order', () => {
    const host = drawn()

    furnish(host, SKIN, 'Me soutenir')

    for (const frame of frames(host)) {
      expect(button(frame)).toHaveAttribute('role', 'button')
      expect(button(frame).tabIndex).toBe(0)
    }
  })

  // Its name comes from what it holds, and the logo has no business in it.
  it('leaves the logo out of the name it announces', () => {
    const host = drawn()

    furnish(host, SKIN, 'Me soutenir')

    for (const frame of frames(host)) {
      expect(button(frame).querySelector('img')).toHaveAttribute('alt', '')
    }
  })

  it('answers Enter and Space the way it answers a click', () => {
    const host = drawn()
    furnish(host, SKIN, 'Me soutenir')
    const target = button(frames(host)[0])
    const clicks: string[] = []
    target.addEventListener('click', () => clicks.push('click'))

    for (const key of ['Enter', ' ']) {
      target.dispatchEvent(
        new (target.ownerDocument.defaultView as Window & typeof globalThis).KeyboardEvent(
          'keydown',
          { key, bubbles: true, cancelable: true },
        ),
      )
    }

    expect(clicks).toHaveLength(2)
  })

  it('leaves every other key to the page', () => {
    const host = drawn()
    furnish(host, SKIN, 'Me soutenir')
    const target = button(frames(host)[0])
    const view = target.ownerDocument.defaultView as Window & typeof globalThis
    const clicks: string[] = []
    target.addEventListener('click', () => clicks.push('click'))

    const event = new view.KeyboardEvent('keydown', { key: 'x', bubbles: true, cancelable: true })
    target.dispatchEvent(event)

    expect(clicks).toHaveLength(0)
    expect(event.defaultPrevented).toBe(false)
  })

  /**
   * `furnish` runs again at every change of theme. A second listener would
   * open the popup and close it again on one keystroke.
   */
  it('listens once, whatever the passes that follow', () => {
    const host = drawn()
    furnish(host, SKIN, 'Me soutenir')
    furnish(host, SKIN, 'Me soutenir')
    const target = button(frames(host)[0])
    const view = target.ownerDocument.defaultView as Window & typeof globalThis
    const clicks: string[] = []
    target.addEventListener('click', () => clicks.push('click'))

    target.dispatchEvent(
      new view.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    )

    expect(clicks).toHaveLength(1)
  })
})
