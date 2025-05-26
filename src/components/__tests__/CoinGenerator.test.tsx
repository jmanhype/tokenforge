import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CoinGenerator } from '../CoinGenerator'

// Mock Convex hooks
vi.mock('convex/react', () => ({
  useMutation: () => vi.fn(),
  useQuery: () => null,
  useAction: () => vi.fn(),
}))

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    promise: vi.fn(),
  },
}))

describe('CoinGenerator', () => {
  it('renders all form fields', () => {
    render(<CoinGenerator />)
    
    expect(screen.getByText('Coin Name *')).toBeInTheDocument()
    expect(screen.getByText('Symbol *')).toBeInTheDocument()
    // Check for description label and field
    expect(screen.getByText('Description (Optional)')).toBeInTheDocument()
    expect(screen.getByText('Initial Supply *')).toBeInTheDocument()
    expect(screen.getByText('Blockchain *')).toBeInTheDocument()
  })

  it('displays blockchain options', () => {
    render(<CoinGenerator />)
    
    // Find the select element by its role
    const blockchainSelect = screen.getByRole('combobox')
    expect(blockchainSelect).toBeInTheDocument()
    
    // Check if options are present in the select
    const options = screen.getAllByRole('option')
    const optionTexts = options.map(opt => opt.textContent)
    expect(optionTexts).toContain('🔷 Ethereum')
    expect(optionTexts).toContain('🟡 Binance Smart Chain')
    expect(optionTexts).toContain('🟣 Solana')
  })

  it('shows all feature checkboxes', () => {
    render(<CoinGenerator />)
    
    expect(screen.getByText('🪙 Mintable')).toBeInTheDocument()
    expect(screen.getByText('🔥 Burnable')).toBeInTheDocument()
    expect(screen.getByText('🔐 Post-Quantum')).toBeInTheDocument()
  })

  it('has submit button', () => {
    render(<CoinGenerator />)
    
    const submitButton = screen.getByRole('button', { name: /Create & Deploy Coin/i })
    expect(submitButton).toBeInTheDocument()
    expect(submitButton).toBeDisabled() // Initially disabled when not logged in
  })

  it('allows user to fill form', async () => {
    const user = userEvent.setup()
    render(<CoinGenerator />)
    
    const nameInput = screen.getByPlaceholderText('e.g., DogeCoin Supreme')
    const symbolInput = screen.getByPlaceholderText('e.g., DOGES')
    const descriptionInput = screen.getByPlaceholderText('Tell the world about your meme coin...')
    const supplyInput = screen.getByRole('spinbutton')
    
    await user.type(nameInput, 'DogeCoin 2.0')
    await user.type(symbolInput, 'DOGE2')
    await user.type(descriptionInput, 'The next generation of meme coins')
    // Clear and type new value
    await user.clear(supplyInput)
    await user.type(supplyInput, '2000000000')
    
    expect(nameInput).toHaveValue('DogeCoin 2.0')
    expect(symbolInput).toHaveValue('DOGE2')
    expect(descriptionInput).toHaveValue('The next generation of meme coins')
    expect(supplyInput).toHaveValue(2000000000)
  })

  it('toggles feature checkboxes', async () => {
    const user = userEvent.setup()
    render(<CoinGenerator />)
    
    // Find checkboxes by their container text
    const mintableContainer = screen.getByText('🪙 Mintable').closest('label')
    const burnableContainer = screen.getByText('🔥 Burnable').closest('label')
    
    const mintCheckbox = mintableContainer?.querySelector('input[type="checkbox"]') as HTMLInputElement
    const burnCheckbox = burnableContainer?.querySelector('input[type="checkbox"]') as HTMLInputElement
    
    expect(mintCheckbox).toBeChecked() // Mintable is checked by default
    expect(burnCheckbox).not.toBeChecked()
    
    await user.click(mintCheckbox)
    await user.click(burnCheckbox)
    
    expect(mintCheckbox).not.toBeChecked() // After click, it's unchecked
    expect(burnCheckbox).toBeChecked()
  })

  it('displays blockchain information', () => {
    render(<CoinGenerator />)
    
    // Check for the "What happens next?" section which contains blockchain info
    expect(screen.getByText('🎯 What happens next?')).toBeInTheDocument()
    expect(screen.getByText('• Smart contract deployment on your chosen blockchain')).toBeInTheDocument()
  })
})