import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { clearAllAccessTokens } from '../features/auth/session-store.js'

afterEach(() => {
  cleanup()
  clearAllAccessTokens()
})
