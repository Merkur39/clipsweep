export interface Identified {
  id: string
}

export type SelectionState = 'all' | 'none' | 'some'

/**
 * Exclusions are stored rather than selections: everything is checked by
 * default, so a clip that appears — a raised threshold, a fresh search — comes
 * in already selected, and the common case costs an empty set.
 */
export function selectedClips<T extends Identified>(
  clips: T[],
  deselected: ReadonlySet<string>,
): T[] {
  return deselected.size === 0 ? clips : clips.filter((clip) => !deselected.has(clip.id))
}

export function toggle(deselected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(deselected)
  if (!next.delete(id)) next.add(id)
  return next
}

export function selectionState(
  clips: readonly Identified[],
  deselected: ReadonlySet<string>,
): SelectionState {
  if (clips.length === 0) return 'none'

  const kept = selectedClips([...clips], deselected).length
  if (kept === clips.length) return 'all'
  return kept === 0 ? 'none' : 'some'
}

/** Clears the selection when everything is checked, restores it otherwise. */
export function toggleAll(
  clips: readonly Identified[],
  deselected: ReadonlySet<string>,
): Set<string> {
  const next = new Set(deselected)

  if (selectionState(clips, deselected) === 'all') {
    for (const clip of clips) next.add(clip.id)
    return next
  }

  // Only the visible clips are restored: a clip hidden by the filter keeps
  // whatever state the user last gave it.
  for (const clip of clips) next.delete(clip.id)
  return next
}
