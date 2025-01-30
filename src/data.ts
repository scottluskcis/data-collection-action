import fs from 'fs'
import { Octokit } from '@octokit/rest'
import { retry } from '@octokit/plugin-retry'
import { throttling } from '@octokit/plugin-throttling'
import { components } from '@octokit/openapi-types'

interface Webhook {
  name: string
  url: string
  active: boolean
  last_response: {
    code: number | null
    status: string | null
    message: string | null
  }
}

interface RepoStats {
  org: string
  name: string
  archived: boolean
  created_at: string | null
  pushed_at: string | null
  updated_at: string | null
  runners: number | null
  secrets: number | null
  variables: number | null
  environments: number | null | undefined
  hooks: Webhook[] | null
}

type RepoType = components['schemas']['repository']

//const IGNORED_ORGS = ['github', 'actions']

const _Octokit = Octokit.plugin(retry, throttling)

async function newClient(url: string, token: string): Promise<Octokit> {
  return new _Octokit({
    auth: token,
    //baseUrl: url,
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
  repo: RepoType
): Promise<RepoStats> => {
  const name = repo.name

  const [runners, secrets, variables, environments, hooks] = await Promise.all([
    getRunnerCount(octokit, org, name),
    getSecretsCount(octokit, org, name),
    getVariablesCount(octokit, org, name),
    getEnvironmentsCount(octokit, org, name),
    webhooks(octokit, org, name)
  ])

  const result: RepoStats = {
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
  return result
}
export async function collectData({
  url,
  token,
  org
}: {
  url: string
  token: string
  org: string
}): Promise<void> {
  const results = []

  const octokit = await newClient(url, token)
  /*
  const _orgs = await client.paginate('GET /organizations', {
    per_page: 100
  })
  const orgs = _orgs
    .map((org) => org.login)
    .filter((org) => !IGNORED_ORGS.includes(org))
    */
  const orgs = [org]
  for (const org of orgs) {
    const _repos = octokit.paginate.iterator(octokit.rest.repos.listForOrg, {
      org: org,
      per_page: 100
    })

    for await (const { data: repos } of _repos) {
      for (const repo of repos) {
        const result = await getRepoStats(octokit, org, repo as RepoType)

        /*
        const name = repo.name
        const runners = await getRunnerCount(octokit, org, name)
        const secrets = await getSecretsCount(octokit, org, name)
        const variables = await getVariablesCount(octokit, org, name)
        const environments = await getEnvironmentsCount(octokit, org, name)
        const hooks = await webhooks(octokit, org, name)
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
        */
        console.log(JSON.stringify(result))
        results.push(result)
      }
    }
    /*
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
    */
  }
  fs.writeFileSync('/tmp/results.json', JSON.stringify(results))
}
