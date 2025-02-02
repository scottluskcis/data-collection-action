import * as core from '@actions/core'
import { collectData } from './data.js'
import { AuthType, DataCollectOptions, OutputFileType } from './types.js'

const logMessage = (
  message: string,
  level: 'info' | 'error' | 'warning' | 'debug'
) => {
  if (!core) {
    console.log(message)
    return
  }

  switch (level) {
    case 'error':
      core.error(message)
      break
    case 'warning':
      core.warning(message)
      break
    case 'debug':
      core.debug(message)
      break
    default:
      core.info(message)
      break
  }
}

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    logMessage('Collecting inputs ...', 'debug')

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
      output_file_type: core.getInput('output_file_type') as OutputFileType,
      logMessage: logMessage
    }

    // Debug logs are only output if the `ACTIONS_STEP_DEBUG` secret is true
    logMessage(`Gathering data for ${options.org} ...`, 'info')

    // collect data
    logMessage(new Date().toTimeString(), 'debug')

    const output_file = await collectData(options)
    logMessage(`Data written to ${output_file}`, 'info')

    logMessage(new Date().toTimeString(), 'debug')

    // Set outputs for other workflow steps to use
    core.setOutput('output_file', output_file)
  } catch (error) {
    logMessage('Error occurred trying to run the action', 'error')
    // Fail the workflow run if an error occurs
    if (error instanceof Error) {
      logMessage(error.message, 'error')
      core.setFailed(error.message)
    }
  }
}
