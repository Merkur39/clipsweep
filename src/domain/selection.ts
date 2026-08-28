export interface Identified {
  id: string
}

export type SelectionState = 'all' | 'none' | 'some'

/**
 * Selections are stored rather than exclusions: nothing is checked by default,
 * so a clip that appears — a raised threshold, a fresh search — comes in
 * unchecked, and no export ever carries a clip the user never pointed at.
 */
export function selectedClips<T extends Identified>(
  clips: readonly T[],
  selected: ReadonlySet<string>,
): T[] {
  return selected.size === 0 ? [] : clips.filter((clip) => selected.has(clip.id))
}

export function toggle(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected)
  if (!next.delete(id)) next.add(id)
  return next
}

export function selectionState(
  clips: readonly Identified[],
  selected: ReadonlySet<string>,
): SelectionState {
  if (clips.length === 0) return 'none'

  const kept = selectedClips(clips, selected).length
  if (kept === clips.length) return 'all'
  return kept === 0 ? 'none' : 'some'
}

/** Checks every displayed clip, or clears them when they were all checked. */
export function toggleAll(
  clips: readonly Identified[],
  selected: ReadonlySet<string>,
): Set<string> {
  const next = new Set(selected)

  if (selectionState(clips, selected) === 'all') {
    for (const clip of clips) next.delete(clip.id)
    return next
  }

  // Only the visible clips are checked: a clip hidden by the filter keeps
  // whatever state the user last gave it.
  for (const clip of clips) next.add(clip.id)
  return next
}
