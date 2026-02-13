/**
 * Test to verify Jest configuration is working correctly
 */
describe('Jest Configuration', () => {
  it('should be able to run tests', () => {
    expect(true).toBe(true)
  })

  it('should have access to Jest globals', () => {
    expect(jest).toBeDefined()
    expect(describe).toBeDefined()
    expect(it).toBeDefined()
    expect(expect).toBeDefined()
  })

  it('should support TypeScript', () => {
    const testString: string = 'TypeScript is working'
    expect(testString).toBe('TypeScript is working')
  })

  it('should have testing-library/jest-dom matchers', () => {
    const element = document.createElement('div')
    element.textContent = 'Hello World'
    document.body.appendChild(element)
    
    expect(element).toBeInTheDocument()
    expect(element).toHaveTextContent('Hello World')
  })
})