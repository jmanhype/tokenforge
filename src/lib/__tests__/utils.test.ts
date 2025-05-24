import { describe, it, expect } from 'vitest'
import { cn } from '../utils'

describe('utils', () => {
  describe('cn', () => {
    it('merges class names correctly', () => {
      const result = cn('bg-red-500', 'text-white')
      expect(result).toBe('bg-red-500 text-white')
    })

    it('handles conditional classes', () => {
      const result = cn('base', { 'conditional': true, 'not-included': false })
      expect(result).toBe('base conditional')
    })

    it('overrides conflicting Tailwind classes', () => {
      const result = cn('bg-red-500', 'bg-blue-500')
      expect(result).toBe('bg-blue-500')
    })

    it('handles arrays of classes', () => {
      const result = cn(['class1', 'class2'], 'class3')
      expect(result).toBe('class1 class2 class3')
    })

    it('filters out falsy values', () => {
      const result = cn('class1', null, undefined, false, '', 'class2')
      expect(result).toBe('class1 class2')
    })

    it('handles empty input', () => {
      const result = cn()
      expect(result).toBe('')
    })
  })
})