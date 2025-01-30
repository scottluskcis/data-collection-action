import fs from 'fs'
import { Octokit } from '@octokit/rest'
import { retry } from '@octokit/plugin-retry'
import { throttling } from '@octokit/plugin-throttling'

const _Octokit = Octokit.plugin(retry, throttling)

async function newClient(token: string): Promise<Octokit> {
  return new _Octokit({
    auth: token,
    baseUrl: process.env.GHES_URL,
    retries: 10,
    throttle: {
      onRateLimit: (retryAfter, options, octokit) => {
        octokit.log.warn(
          `Request quota exhausted for request ${options.method} ${options.url}`
        )
        if (options.request.retryCount === 0) {
          octokit.log.info(`Retrying after ${retryAfter} seconds!`)
          return true
        }
      },
      onSecondaryRateLimit: (retryAfter, options, octokit) => {
        octokit.log.warn(
          `Abuse detected for request ${options.method} ${options.url}`
        )
        if (options.request.retryCount === 0) {
          octokit.log.info(`Retrying after ${retryAfter} seconds!`)
          return true
        }
      }
    }
  })
}

const IGNORED_ORGS = ['github', 'actions']

const getRunnerCount = async (client: Octokit, org: string, repo: string) => {
  try {
    const { data: runners } = await client.request(
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

const getSecretsCount = async (client: Octokit, org: string, repo: string) => {
  try {
    const { data: secrets } = await client.request(
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
  client: Octokit,
  org: string,
  repo: string
) => {
  try {
    const { data: variables } = await client.request(
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
  client: Octokit,
  org: string,
  repo: string
) => {
  try {
    const { data: environments } = await client.request(
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

const webhooks = async (client: Octokit, org: string, repo: string) => {
  try {
    const webhooks = await client.paginate('GET /repos/{owner}/{repo}/hooks', {
      owner: org,
      repo: repo,
      per_page: 100
    })
    return webhooks.map((hook) => {
      return {
        name: hook.name,
        url: hook.config.url,
        active: hook.active,
        last_response: hook.last_response
      }
    })
  } catch (e: unknown) {
    const error = e as Error
    console.error(`Error getting runners for ${org}/${repo}: ${error.message}`)
    return null
  }
}

export async function collectData() {
  const results = []

  const token = process.env.GHES_TOKEN
  if (!token) {
    console.error('GHES_TOKEN environment variable is required')
    return
  }

  const client = await newClient(token)
  const _orgs = await client.paginate('GET /organizations', {
    per_page: 100
  })
  const orgs = _orgs
    .map((org) => org.login)
    .filter((org) => !IGNORED_ORGS.includes(org))
  for (const org of orgs) {
    const repos = await client.paginate('GET /orgs/{org}/repos', {
      org: org,
      per_page: 100
    })
    for (const repo of repos) {
      const name = repo.name
      const runners = await getRunnerCount(client, org, name)
      const secrets = await getSecretsCount(client, org, name)
      const variables = await getVariablesCount(client, org, name)
      const environments = await getEnvironmentsCount(client, org, name)
      const hooks = await webhooks(client, org, name)
      const result = {
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
      console.log(JSON.stringify(result))
      results.push(result)
    }
  }
  fs.writeFileSync('/tmp/results.json', JSON.stringify(results))
}
