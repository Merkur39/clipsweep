// @vitest-environment jsdom
import { fireEvent } from '@testing-library/dom'
import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useHotkey } from './useHotkey'

afterEach(() => {
  document.body.innerHTML = ''
})

/** A field to type into, focused, as a page always has one somewhere. */
const focusedField = () => {
  const input = document.createElement('input')
  document.body.append(input)
  input.focus()
  return input
}

describe('useHotkey', () => {
  it('runs on the key it was given', () => {
    const run = vi.fn()
    renderHook(() => useHotkey({ key: 'k', command: true }, run))

    fireEvent.keyDown(document, { key: 'k', metaKey: true })

    expect(run).toHaveBeenCalledTimes(1)
  })

  it('ignores every other key', () => {
    const run = vi.fn()
    renderHook(() => useHotkey({ key: '1' }, run))

    fireEvent.keyDown(document, { key: '2' })

    expect(run).not.toHaveBeenCalled()
  })

  // Windows and Linux say Ctrl where Apple says ⌘, and a shortcut drawn for one
  // has to answer on the other: the interface names the key, the browser does
  // not.
  it('takes either command key', () => {
    const run = vi.fn()
    renderHook(() => useHotkey({ key: 'k', command: true }, run))

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true })

    expect(run).toHaveBeenCalledTimes(1)
  })

  it('refuses a bare key where a command was asked for', () => {
    const run = vi.fn()
    renderHook(() => useHotkey({ key: 'k', command: true }, run))

    fireEvent.keyDown(document, { key: 'k' })

    expect(run).not.toHaveBeenCalled()
  })

  it('refuses a command where a bare key was asked for', () => {
    const run = vi.fn()
    renderHook(() => useHotkey({ key: '1' }, run))

    fireEvent.keyDown(document, { key: '1', metaKey: true })

    expect(run).not.toHaveBeenCalled()
  })

  // A bare key typed into a field is a character, not a shortcut.
  it('leaves a bare key alone while something is being typed into', () => {
    const run = vi.fn()
    renderHook(() => useHotkey({ key: '1' }, run))

    fireEvent.keyDown(focusedField(), { key: '1' })

    expect(run).not.toHaveBeenCalled()
  })

  /**
   * A command shortcut works everywhere, fields included: that is what the
   * modifier buys, and every application that has one behaves this way.
   */
  it('answers a command shortcut from inside a field', () => {
    const run = vi.fn()
    renderHook(() => useHotkey({ key: 'k', command: true }, run))

    fireEvent.keyDown(focusedField(), { key: 'k', metaKey: true })

    expect(run).toHaveBeenCalledTimes(1)
  })

  /**
   * The space bar activates whatever is focused. Taken from a focused control,
   * it would stop every button on the page from answering the keyboard — the
   * shortcut would have bought a clip player at the price of the tab order.
   */
  it('leaves the space bar to the control that already answers it', () => {
    const run = vi.fn()
    renderHook(() => useHotkey({ key: ' ' }, run))
    const button = document.createElement('button')
    document.body.append(button)
    button.focus()

    fireEvent.keyDown(button, { key: ' ' })

    expect(run).not.toHaveBeenCalled()
  })

  it('answers the space bar anywhere else', () => {
    const run = vi.fn()
    renderHook(() => useHotkey({ key: ' ' }, run))

    fireEvent.keyDown(document.body, { key: ' ' })

    expect(run).toHaveBeenCalledTimes(1)
  })

  // Only the space bar has that quarrel: a digit activates nothing, so a chip
  // left focused by a click must not swallow it.
  it('keeps answering other keys from a focused control', () => {
    const run = vi.fn()
    renderHook(() => useHotkey({ key: '1' }, run))
    const button = document.createElement('button')
    document.body.append(button)
    button.focus()

    fireEvent.keyDown(button, { key: '1' })

    expect(run).toHaveBeenCalledTimes(1)
  })

  it('stops listening when it goes', () => {
    const run = vi.fn()
    const { unmount } = renderHook(() => useHotkey({ key: '1' }, run))

    unmount()
    fireEvent.keyDown(document, { key: '1' })

    expect(run).not.toHaveBeenCalled()
  })
})
