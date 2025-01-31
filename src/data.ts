import fs from 'fs/promises'
import { Octokit } from 'octokit'
import { DataCollectOptions, RepoStats, RepoType, Webhook } from './types.js'
import { createClient } from './client.js'

const getRunnerCount = async (octokit: Octokit, org: string, repo: string) => {
  try {
    const { data: runners } = await octokit.request(
      'GET /repos/{owner}/{repo}/actions/runners',
      {
        owner: org,
        repo: repo,
        per_page: 1
      }
    )
    return runners.total_count
  } catch (e: unknown) {
    const error = e as Error
    console.error(`Error getting runners for ${org}/${repo}: ${error.message}`)
    return null
  }
}

const getSecretsCount = async (octokit: Octokit, org: string, repo: string) => {
  try {
    const { data: secrets } = await octokit.request(
      'GET /repos/{owner}/{repo}/actions/secrets',
      {
        owner: org,
        repo: repo,
        per_page: 1
      }
    )
    return secrets.total_count
  } catch (e: unknown) {
    const error = e as Error
    console.error(`Error getting runners for ${org}/${repo}: ${error.message}`)
    return null
  }
}

const getVariablesCount = async (
  octokit: Octokit,
  org: string,
  repo: string
) => {
  try {
    const { data: variables } = await octokit.request(
      'GET /repos/{owner}/{repo}/actions/variables',
      {
        owner: org,
        repo: repo,
        per_page: 1
      }
    )
    return variables.total_count
  } catch (e: unknown) {
    const error = e as Error
    console.error(`Error getting runners for ${org}/${repo}: ${error.message}`)
    return null
  }
}

const getEnvironmentsCount = async (
  octokit: Octokit,
  org: string,
  repo: string
) => {
  try {
    const { data: environments } = await octokit.request(
      'GET /repos/{owner}/{repo}/environments',
      {
        owner: org,
        repo: repo,
        per_page: 1
      }
    )
    return environments.total_count
  } catch (e: unknown) {
    const error = e as Error
    console.error(`Error getting runners for ${org}/${repo}: ${error.message}`)
    return null
  }
}

const webhooks = async (
  octokit: Octokit,
  org: string,
  repo: string
): Promise<Webhook[] | null> => {
  try {
    const webhooks = await octokit.paginate('GET /repos/{owner}/{repo}/hooks', {
      owner: org,
      repo: repo,
      per_page: 100
    })
    return webhooks.map((hook) => {
      return {
        name: hook.name,
        url: hook.config.url || '',
        active: hook.active,
        last_response: {
          code: hook.last_response.code,
          status: hook.last_response.status,
          message: hook.last_response.message
        }
      }
    })
  } catch (e: unknown) {
    const error = e as Error
    console.error(`Error getting runners for ${org}/${repo}: ${error.message}`)
    return null
  }
}

const getRepoStats = async (
  octokit: Octokit,
  org: string,
  repo: RepoType,
  include_hooks: boolean | undefined
): Promise<RepoStats> => {
  let result: RepoStats
  if (repo.archived) {
    result = {
      org: org,
      name: repo.name,
      archived: repo.archived,
      created_at: repo.created_at,
      pushed_at: repo.pushed_at,
      updated_at: repo.updated_at,
      runners: null,
      secrets: null,
      variables: null,
      environments: null,
      hooks: null
    }
  } else {
    const name = repo.name

    const runners = await getRunnerCount(octokit, org, name)
    const secrets = await getSecretsCount(octokit, org, name)
    const variables = await getVariablesCount(octokit, org, name)
    const environments = await getEnvironmentsCount(octokit, org, name)
    const hooks = include_hooks ? await webhooks(octokit, org, name) : null

    result = {
      org: org,
      name: name,
      archived: repo.archived,
      created_at: repo.created_at,
      pushed_at: repo.pushed_at,
      updated_at: repo.updated_at,
      runners: runners,
      secrets: secrets,
      variables: variables,
      environments: environments,
      hooks: hooks
    }
  }
  return result
}

export async function collectData(options: DataCollectOptions): Promise<void> {
  const filePath = 'results.json'
  await fs.writeFile(filePath, '[\n', 'utf8')

  const octokit = await createClient(options)
  const orgs = [options.org]
  for (const org of orgs) {
    const _repos = octokit.paginate.iterator(octokit.rest.repos.listForOrg, {
      org: org,
      per_page: 100
    })

    let first = true
    for await (const { data: repos } of _repos) {
      for (const repo of repos) {
        const result = await getRepoStats(
          octokit,
          org,
          repo as RepoType,
          options.include_hooks
        )
        console.log(JSON.stringify(result))

        // Write the result to the file incrementally
        const json = JSON.stringify(result, null, 2)
        await fs.appendFile(filePath, `${first ? '' : ',\n'}${json}`, 'utf8')
        first = false
      }
    }
  }

  await fs.appendFile(filePath, '\n]', 'utf8')
}
