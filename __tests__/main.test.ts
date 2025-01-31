import { jest } from '@jest/globals'
import * as core from '../__fixtures__/core.js'
import { collectData } from '../__fixtures__/data.js'

// Mocks should be declared before the module being tested is imported.
jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('../src/data.js', () => ({ collectData }))

// The module being tested should be imported dynamically. This ensures that the
// mocks are used in place of any actual dependencies.
const { run } = await import('../src/main.js')

describe('main.ts', () => {
  beforeEach(() => {
    // Set the action's inputs as return values from core.getInput().
    core.getInput.mockImplementation((name: string) => {
      const inputs: { [key: string]: string } = {
        org: 'test-org',
        api_url: 'https://api.github.com',
        token: 'test-token',
        auth_type: 'app',
        is_debug: 'true',
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
        app_id: 'test-app-id',
        app_private_key: 'test-app-private-key',
        app_installation_id: 'test-app-installation-id'
      }
      return inputs[name]
    })

    // Mock the collectData function so that it does not actually run.
    collectData.mockImplementation(() => Promise.resolve())
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('Sets the file output', async () => {
    await run()

    // Verify the file output was set.
    expect(core.setOutput).toHaveBeenNthCalledWith(
      1,
      'file',
      // Simple regex to match a time string in the format HH:MM:SS.
      expect.stringMatching(/^\d{2}:\d{2}:\d{2}/)
    )
  })

  it('Sets a failed status on error', async () => {
    // Mock the collectData function to throw an error.
    collectData.mockImplementationOnce(() => {
      throw new Error('collectData failed')
    })

    await run()

    // Verify that the action was marked as failed.
    expect(core.setFailed).toHaveBeenNthCalledWith(1, 'collectData failed')
  })
})
