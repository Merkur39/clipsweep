// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import { render } from '../test-render'
import { describe, expect, it, vi } from 'vitest'

import { SelectionBar, type SelectionBarProps } from './SelectionBar'

const setup = (props: Partial<SelectionBarProps> = {}) => {
  const handlers = {
    onDownloadScript: vi.fn(),
    onExportCsv: vi.fn(),
    onExportJson: vi.fn(),
    onExportUrls: vi.fn(),
    onClear: vi.fn(),
  }
  const view = render(
    <SelectionBar
      selected={12}
      flavor="bat"
      scriptFiles={{ bat: 'telecharger.bat', sh: 'telecharger.sh' }}
      {...handlers}
      {...props}
    />,
  )
  return { ...handlers, ...view }
}

const menu = () => screen.getByRole('button', { name: /Exporter/ })
const item = (name: string | RegExp) => screen.getByRole('button', { name })

/**
 * What can be done with what is picked, floating over the readout. It replaces
 * two blocks at the foot of the page — which were as far from the clips as a
 * control can get, and which stood there stating "no clip selected" for the
 * whole of every session that never picked one.
 */
describe('SelectionBar', () => {
  it('stays away until something is picked', () => {
    const { container } = setup({ selected: 0 })

    expect(container).toBeEmptyDOMElement()
  })

  it('says how much is picked', () => {
    setup({ selected: 12 })

    expect(screen.getByText('12 clips sélectionnés')).toBeInTheDocument()
  })

  it('agrees the singular', () => {
    setup({ selected: 1 })

    expect(screen.getByText('1 clip sélectionné')).toBeInTheDocument()
  })

  // The one thing most visitors came for, so the one button that carries the
  // accent — and it needs no choosing: the platform is already known.
  it('downloads the script of the platform it detected', () => {
    const { onDownloadScript } = setup({ flavor: 'sh' })

    fireEvent.click(item('Télécharger'))

    expect(onDownloadScript).toHaveBeenCalledWith('sh')
  })

  it('files the other platform in the menu', () => {
    const { onDownloadScript } = setup({ flavor: 'bat' })

    fireEvent.click(menu())
    fireEvent.click(item(/Script macOS/))

    expect(onDownloadScript).toHaveBeenCalledWith('sh')
  })

  /**
   * No detection, no guess: both scripts go in the menu and nothing claims to
   * know which one to press. Downloading the wrong one is a file that does
   * nothing on the machine it lands on.
   */
  it('offers both scripts, and no shortcut, when the platform is unknown', () => {
    const { onDownloadScript } = setup({ flavor: null })

    expect(screen.queryByRole('button', { name: 'Télécharger' })).toBeNull()

    fireEvent.click(menu())
    fireEvent.click(item(/Script Windows/))
    fireEvent.click(menu())
    fireEvent.click(item(/Script macOS/))

    expect(onDownloadScript).toHaveBeenNthCalledWith(1, 'bat')
    expect(onDownloadScript).toHaveBeenNthCalledWith(2, 'sh')
  })

  it('exports the list in the three shapes', () => {
    const { onExportCsv, onExportJson, onExportUrls } = setup()

    fireEvent.click(menu())
    fireEvent.click(item('CSV'))
    fireEvent.click(menu())
    fireEvent.click(item('JSON'))
    fireEvent.click(menu())
    fireEvent.click(item(/URLs/))

    expect(onExportCsv).toHaveBeenCalledTimes(1)
    expect(onExportJson).toHaveBeenCalledTimes(1)
    expect(onExportUrls).toHaveBeenCalledTimes(1)
  })

  it('closes the menu on the way out', () => {
    setup()
    fireEvent.click(menu())

    fireEvent.click(item('CSV'))

    expect(screen.queryByRole('button', { name: 'CSV' })).toBeNull()
  })

  it('closes it on escape as well', () => {
    setup()
    fireEvent.click(menu())

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('button', { name: 'CSV' })).toBeNull()
  })

  // Where the picking gets undone: the ticket above only ever offers to pick
  // everything, so neither control ever says the other's word.
  it('drops the selection', () => {
    const { onClear } = setup()

    fireEvent.click(item('Tout désélectionner'))

    expect(onClear).toHaveBeenCalledTimes(1)
  })
})

/**
 * What the primary button hands over is a script, and the one sentence saying so
 * lived inside a menu the primary path never opens. Past the click there is no
 * interface left — only a file in a folder — so the explanation is given at the
 * moment the file lands, which is the moment the question is asked.
 */
describe('SelectionBar, once the script is handed over', () => {
  const handed = () => screen.queryByRole('status')

  it('says nothing until something has been downloaded', () => {
    setup()

    expect(handed()).toBeNull()
  })

  it('says where the file went and what it is', () => {
    setup()

    fireEvent.click(item(/Télécharger/))

    expect(handed()).toHaveTextContent('Le script est dans tes téléchargements.')
    expect(handed()).toHaveTextContent(/sans rien installer/)
  })

  /* The instruction is not the same on the two platforms, and it is the whole
     of what the file is worth: a `.bat` nobody double-clicks does nothing. */
  it('tells a Windows visitor to double-click it', () => {
    setup({ flavor: 'bat' })

    fireEvent.click(item(/Télécharger/))

    expect(handed()).toHaveTextContent(/double-clique/)
  })

  it('gives a Unix visitor the command, on the file’s own name', () => {
    setup({ flavor: 'sh', scriptFiles: { bat: 'a.bat', sh: 'telecharger-les-clips-kaliyami.sh' } })

    fireEvent.click(item(/Télécharger/))

    expect(handed()).toHaveTextContent(
      'chmod +x telecharger-les-clips-kaliyami.sh && ./telecharger-les-clips-kaliyami.sh',
    )
  })

  // The menu hands over the same file, so it owes the same word about it.
  it('says as much for a script taken from the menu', () => {
    setup({ flavor: 'bat' })
    fireEvent.click(menu())

    fireEvent.click(item(/Script macOS/))

    expect(handed()).toHaveTextContent(/chmod \+x/)
  })

  it('goes away when told to', () => {
    setup()
    fireEvent.click(item(/Télécharger/))

    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))

    expect(handed()).toBeNull()
  })

  /* A list of metadata is a file whose name says what it is; nothing has to be
     run, so nothing has to be explained. */
  it('stays away for an export that is not a script', () => {
    setup()
    fireEvent.click(menu())

    fireEvent.click(item('CSV'))

    expect(handed()).toBeNull()
  })
})
