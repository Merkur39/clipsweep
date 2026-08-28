import { describe, expect, it } from 'vitest'

import { toCsv } from './csv'
import type { Clip } from '../twitch/types'

const clip = (over: Partial<Clip> = {}): Clip => ({
  id: 'abc',
  url: 'https://clips.twitch.tv/abc',
  embed_url: 'https://clips.twitch.tv/embed?clip=abc',
  broadcaster_name: 'ZeratoR',
  creator_name: 'SpiZ',
  title: 'A clip',
  view_count: 42,
  created_at: '2024-03-02T10:00:00Z',
  thumbnail_url: 'https://static.twitch.tv/abc.jpg',
  duration: 30,
  game_id: '509658',
  ...over,
})

const lines = (csv: string) => csv.replace('\uFEFF', '').split('\n')

describe('toCsv', () => {
  it('opens with a byte order mark, so Excel reads it as UTF-8', () => {
    expect(toCsv([clip({ title: 'Café' })]).startsWith('\uFEFF')).toBe(true)
  })

  it('heads the file with the exported columns, in order', () => {
    expect(lines(toCsv([]))[0]).toBe('id,url,title,view_count,created_at,creator_name,duration')
  })

  it('writes one row per clip, in the order given', () => {
    const rows = lines(toCsv([clip({ id: 'first' }), clip({ id: 'second' })]))

    expect(rows).toHaveLength(3)
    expect(rows[1]).toContain('"first"')
    expect(rows[2]).toContain('"second"')
  })

  /* The two characters that would otherwise end a cell or a field. A title is
     the one column a broadcaster writes by hand, so both turn up in real
     exports. */
  it('keeps a comma inside its cell rather than opening a column', () => {
    const row = lines(toCsv([clip({ title: 'Wait, what?' })]))[1]

    expect(row).toContain('"Wait, what?"')
    expect(row.split('","')).toHaveLength(7)
  })

  it('doubles a quote in a title instead of closing the cell on it', () => {
    expect(lines(toCsv([clip({ title: 'The "play" of the year' })]))[1]).toContain(
      '"The ""play"" of the year"',
    )
  })

  /* Helix has answered with a missing field before, and an export is read long
     after the search that produced it: an empty cell says nothing, where the
     word `undefined` in a spreadsheet reads as data. */
  it('writes an empty cell for a field the payload did not carry', () => {
    const row = lines(toCsv([clip({ creator_name: undefined as unknown as string })]))[1]

    expect(row).toContain(',"",')
  })

  it('exports only the seven columns, never the whole payload', () => {
    expect(toCsv([clip()])).not.toContain('thumbnail_url')
    expect(toCsv([clip()])).not.toContain('static.twitch.tv')
  })
})
