import fs from 'fs'
import { Octokit } from 'octokit'
import { components } from '@octokit/openapi-types'
import { createAppAuth } from '@octokit/auth-app'
import { createTokenAuth } from '@octokit/auth-token'

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

export interface DataCollectOptions {
  org: string
  api_url: string
  auth_type: string
  token: string | undefined
  is_debug: boolean | undefined
  client_id: string | undefined
  client_secret: string | undefined
  app_id: string | undefined
  app_private_key: string | undefined
  app_installation_id: string | undefined
}

// TODO: add this back to support ignoring certain orgs
//const IGNORED_ORGS = ['github', 'actions']

function getInstallationAuthConfig(options: DataCollectOptions) {
  if (!options.app_id) {
    throw new Error('app_id is required')
  }
  if (!options.app_private_key) {
    throw new Error('app_private_key is required')
  }
  if (!options.app_installation_id) {
    throw new Error('app_installation_id is required')
  }

  const authStrategy = createAppAuth
  const auth = {
    appId: parseInt(options.app_id),
    privateKey: options.app_private_key,
    installationId: parseInt(options.app_installation_id)
  }

  return { authStrategy, auth }
}

function getAppAuthConfig(options: DataCollectOptions) {
  if (!options.app_id) {
    throw new Error('app_id is required')
  }
  if (!options.app_private_key) {
    throw new Error('app_private_key is required')
  }
  if (!options.client_id) {
    throw new Error('client_id is required')
  }
  if (!options.client_secret) {
    throw new Error('client_secret is required')
  }

  const authStrategy = createAppAuth
  const auth = {
    appId: parseInt(options.app_id),
    privateKey: options.app_private_key,
    clientId: options.client_id,
    clientSecret: options.client_secret
  }

  return { authStrategy, auth }
}

function getDefaultAuthConfig(options: DataCollectOptions) {
  if (!options.token) {
    throw new Error('token is required')
  }

  return { authStrategy: createTokenAuth, auth: options.token }
}

function getAuthConfig(options: DataCollectOptions) {
  if (options.auth_type === 'installation') {
    return getInstallationAuthConfig(options)
  } else if (options.auth_type === 'app') {
    return getAppAuthConfig(options)
  } else {
    return getDefaultAuthConfig(options)
  }
}

async function newClient(options: DataCollectOptions): Promise<Octokit> {
  if (!options) {
    throw new Error('options are required')
  }

  const { authStrategy, auth } = getAuthConfig(options)
  const octokitOptions = {
    authStrategy,
    auth
  }

  /*

    auth: {
    appId: 1,
    privateKey: "-----BEGIN PRIVATE KEY-----\n...",
    clientId: "1234567890abcdef1234",
    clientSecret: "1234567890abcdef1234567890abcdef12345678",
  },



  const installationOctokit = new Octokit({
  authStrategy: createAppAuth,
  auth: {
    appId: 1,
    privateKey: "-----BEGIN PRIVATE KEY-----\n...",
    installationId: 123,
  },
});


const auth = createAppAuth({
  appId: 1,
  privateKey: "-----BEGIN PRIVATE KEY-----\n...",
  clientId: "lv1.1234567890abcdef",
  clientSecret: "1234567890abcdef12341234567890abcdef1234",
});

// Retrieve installation access token
const installationAuthentication = await auth({
  type: "installation",
  installationId: 123,
});
  */

  return new Octokit(octokitOptions)
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
    const hooks = await webhooks(octokit, org, name)

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
  const results = []

  const octokit = await newClient(options)
  // TODO: add this back to support list all orgs
  /*
  const _orgs = await client.paginate('GET /organizations', {
    per_page: 100
  })
  const orgs = _orgs
    .map((org) => org.login)
    .filter((org) => !IGNORED_ORGS.includes(org))
    */
  const orgs = [options.org]
  for (const org of orgs) {
    const _repos = octokit.paginate.iterator(octokit.rest.repos.listForOrg, {
      org: org,
      per_page: 100
    })

    for await (const { data: repos } of _repos) {
      for (const repo of repos) {
        const result = await getRepoStats(octokit, org, repo as RepoType)
        console.log(JSON.stringify(result))
        results.push(result)
      }
      if (results.length > 500) {
        break // TODO remove this, adding temporarily to limit the number of requests
      }
    }
  }
  fs.writeFileSync('/tmp/results.json', JSON.stringify(results))
}
