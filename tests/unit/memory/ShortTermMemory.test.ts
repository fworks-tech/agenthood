import { describe, it, expect } from 'vitest'
import { ShortTermMemoryImpl } from '../../../src/memory/ShortTermMemory.js'

describe('ShortTermMemoryImpl', () => {
  it('adds messages to the buffer', () => {
    const mem = new ShortTermMemoryImpl(5)
    mem.add('hello')
    expect(mem.size()).toBe(1)
  })

  it('returns recent n messages', () => {
    const mem = new ShortTermMemoryImpl(10)
    mem.add('a')
    mem.add('b')
    mem.add('c')
    expect(mem.getRecent(2)).toEqual(['b', 'c'])
  })

  it('returns all messages when n exceeds buffer size', () => {
    const mem = new ShortTermMemoryImpl(10)
    mem.add('a')
    mem.add('b')
    expect(mem.getRecent(10)).toEqual(['a', 'b'])
  })

  it('truncates to capacity on overflow', () => {
    const mem = new ShortTermMemoryImpl(3)
    mem.add('a')
    mem.add('b')
    mem.add('c')
    mem.add('d')
    expect(mem.size()).toBe(3)
    expect(mem.getRecent(3)).toEqual(['b', 'c', 'd'])
  })

  it('clears the buffer', () => {
    const mem = new ShortTermMemoryImpl(5)
    mem.add('a')
    mem.add('b')
    mem.clear()
    expect(mem.size()).toBe(0)
  })

  it('returns empty array when nothing added', () => {
    const mem = new ShortTermMemoryImpl(5)
    expect(mem.getRecent(5)).toEqual([])
  })
})
