import * as core from '@actions/core'
import { collectData } from './data.js'
import { AuthType, DataCollectOptions } from './types.js'

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const options: DataCollectOptions = {
      org: core.getInput('org'),
      api_url: core.getInput('api_url'),
      token: core.getInput('token'),
      auth_type: core.getInput('auth_type', {
        required: true
      }) as AuthType,
      is_debug: core.getInput('is_debug') === 'true' ? true : false,
      client_id: core.getInput('client_id'),
      client_secret: core.getInput('client_secret'),
      app_id: core.getInput('app_id'),
      app_private_key: core.getInput('app_private_key'),
      app_installation_id: core.getInput('app_installation_id'),
      include_hooks: core.getInput('include_hooks') === 'true' ? true : false,
      output_csv: core.getInput('output_csv') === 'true' ? true : false
    }

    // Debug logs are only output if the `ACTIONS_STEP_DEBUG` secret is true
    core.debug(`Gathering data for ${options.org} ...`)

    // Log the current timestamp, wait, then log the new timestamp
    core.debug(new Date().toTimeString())
    await collectData(options)
    //await wait(parseInt(ms, 10))
    core.debug(new Date().toTimeString())

    // Set outputs for other workflow steps to use
    core.setOutput('file', new Date().toTimeString())
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
