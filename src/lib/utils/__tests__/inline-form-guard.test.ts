import { isDirectFormSubmit } from '@/lib/utils/inline-form-guard'

describe('isDirectFormSubmit', () => {
  it('returns true when target is the form itself', () => {
    const form = document.createElement('form')
    const event = {
      target: form,
      currentTarget: form,
    } as unknown as React.FormEvent<HTMLFormElement>
    expect(isDirectFormSubmit(event)).toBe(true)
  })

  it('returns false when submit comes from a nested inline form', () => {
    const parent = document.createElement('form')
    const child = document.createElement('form')
    const event = {
      target: child,
      currentTarget: parent,
    } as unknown as React.FormEvent<HTMLFormElement>
    expect(isDirectFormSubmit(event)).toBe(false)
  })
})
