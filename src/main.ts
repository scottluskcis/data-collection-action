import * as core from '@actions/core'
//import { wait } from './wait.js'
import { collectData } from './data.js'

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const ms: string = core.getInput('milliseconds')

    const url = process.env.GH_SOURCE_URL
    if (!url) {
      throw new Error('GH_SOURCE_URL is not set')
    }

    const token = process.env.GH_SOURCE_TOKEN
    if (!token) {
      throw new Error('GH_SOURCE_TOKEN is not set')
    }

    const org = process.env.GH_SOURCE_ORG
    if (!org) {
      throw new Error('GH_SOURCE_ORG is not set')
    }

    // Debug logs are only output if the `ACTIONS_STEP_DEBUG` secret is true
    core.debug(`Waiting ${ms} milliseconds ...`)

    // Log the current timestamp, wait, then log the new timestamp
    core.debug(new Date().toTimeString())
    await collectData({ url, token, org })
    //await wait(parseInt(ms, 10))
    core.debug(new Date().toTimeString())

    // Set outputs for other workflow steps to use
    core.setOutput('time', new Date().toTimeString())
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
