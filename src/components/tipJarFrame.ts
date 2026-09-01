/**
 * The inside of the Ko-fi widget's frames, which is where its button actually
 * lives.
 *
 * The widget draws its button inside an `<iframe>` it writes itself, and a
 * frame is a document of its own: not one of the page's tokens reaches it, and
 * `light-dark()` there resolves against a colour scheme that is not the page's.
 * So the page resolves its own control first — on a probe element whose only
 * job is to be read back — and writes the answer into the frame.
 *
 * Same-origin throughout: the frames are `about:blank` documents the widget
 * fills with `document.write`, so the page may reach into them. What it does
 * not control is their content, which is fetched from a CDN and may change:
 * every step below is written to no-op rather than to throw when what it looks
 * for is not there.
 */

/** The page's own button, resolved for the theme in force. */
export interface Skin {
  ink: string
  fill: string
  edge: string
  hoverFill: string
  hoverEdge: string
  ring: string
  font: string
}

/** Their button, and the image inside it. Both come from the CDN's sheet. */
const BUTTON = '.floatingchat-donate-button'

/** Ours, so a second pass replaces the first rather than piling onto it. */
const SHEET = 'tip-jar-skin'

/** Ours too: the mark that says the frame's button already listens. */
const KEYED = 'tipJarKeys'

/**
 * The values of `Skin`, read off one element.
 *
 * The pairing of property to role is arbitrary and it is deliberate: what
 * matters is that the sheet declares them and this reads them, in the same
 * order, without either side having to name a colour. `tip-jar.css` holds the
 * other half, and `scripts/geometry/tip-jar.test.ts` holds the two together.
 */
export function readSkin(probe: Element): Skin {
  const resolved = getComputedStyle(probe)

  return {
    ink: resolved.color,
    fill: resolved.backgroundColor,
    edge: resolved.borderTopColor,
    hoverFill: resolved.borderLeftColor,
    hoverEdge: resolved.borderBottomColor,
    ring: resolved.outlineColor,
    font: resolved.fontFamily,
  }
}

/**
 * The sheet written into a frame.
 *
 * `!important` on every declaration, and not for want of specificity: the
 * widget writes its colours as inline styles on the button it builds, and an
 * inline declaration is what these have to outweigh.
 *
 * The button is stretched to the whole frame on purpose. What Ko-fi leaves
 * around it is a fixed rectangle sitting eight digits up the stack, and every
 * pixel of it that is not button is a pixel that swallows a click meant for the
 * readout underneath.
 */
export const frameStyle = (skin: Skin): string => `
html, body { width: 100%; height: 100%; }
body { position: static !important; }

${BUTTON} {
  box-sizing: border-box !important;
  width: 100% !important;
  height: 100% !important;
  justify-content: center !important;
  gap: 7px !important;
  padding: 0 14px !important;
  background-color: ${skin.fill} !important;
  border: 1px solid ${skin.edge} !important;
  color: ${skin.ink} !important;
  font-family: ${skin.font} !important;
  font-size: 13px !important;
  font-weight: 550 !important;
  transition: background-color 0.12s, border-color 0.12s !important;
}

${BUTTON} span { margin: 0 !important; color: ${skin.ink} !important; }

${BUTTON}:hover {
  background-color: ${skin.hoverFill} !important;
  border-color: ${skin.hoverEdge} !important;
}

/* The page's ring, turned inwards. Everywhere else it sits 2px clear of the
   control; here the frame IS the button, so a ring outside the button is a
   ring outside the frame, and the frame clips it. */
${BUTTON}:focus-visible {
  outline: 2px solid ${skin.ring} !important;
  outline-offset: -4px !important;
}

.kofiimg { width: 26px !important; }
`

/**
 * Gives the widget's button back to the keyboard.
 *
 * Ko-fi builds it as a bare `<div>` with a click listener: no role, no place in
 * the tab order, and therefore nothing a screen reader announces or a `Tab`
 * reaches. The three lines that fix it have to be applied here, from outside,
 * because the markup comes from a CDN.
 *
 * The listener goes on once and is marked as such — `furnish` runs again at
 * every change of theme, and a second listener would open the popup and close
 * it in the same keystroke. It cannot collide with the page's own shortcuts
 * either: a key pressed inside a frame does not reach the document that holds
 * it.
 *
 * The image loses its `alt` rather than gaining one: the name of the button is
 * the label beside it, and a second reading of "ko-fi" before it says nothing
 * a visitor of this corner does not already see.
 */
function reachable(button: HTMLElement): void {
  button.setAttribute('role', 'button')
  button.tabIndex = 0

  const image = button.querySelector('img')
  if (image) image.alt = ''

  if (button.dataset[KEYED]) return
  button.dataset[KEYED] = 'on'
  button.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    button.click()
  })
}

/**
 * Dresses whatever the widget has drawn under `host`, in the page's colours and
 * in the page's language.
 *
 * Two frames every time: the widget draws a desktop one and a mobile one, and
 * hides one of the two by media query rather than by leaving it out.
 */
export function furnish(host: Element, skin: Skin, label: string): void {
  for (const frame of host.querySelectorAll('iframe')) {
    const inside = frame.contentDocument
    if (!inside?.head) continue

    frame.title = label

    const sheet = inside.getElementById(SHEET) ?? inside.createElement('style')
    sheet.id = SHEET
    sheet.textContent = frameStyle(skin)
    inside.head.append(sheet)

    const button = inside.querySelector<HTMLElement>(BUTTON)
    if (!button) continue

    const caption = button.querySelector('span')
    if (caption) caption.textContent = label

    reachable(button)
  }
}
