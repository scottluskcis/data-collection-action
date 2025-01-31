import fs from 'fs/promises'
import { json2csv } from 'json-2-csv'
import { Octokit } from 'octokit'
import {
  CollectData,
  DataCollectOptions,
  RepoStats,
  RepoType,
  Webhook
} from './types.js'
import { createClient } from './client.js'

class DataCollector implements CollectData {
  private octokit: Octokit
  private options: DataCollectOptions

  constructor(octokit: Octokit, options: DataCollectOptions) {
    this.octokit = octokit
    this.options = options
  }

  getRunnerCount = async (org: string, repo: string): Promise<number> => {
    const { data: runners } = await this.octokit.request(
      'GET /repos/{owner}/{repo}/actions/runners',
      {
        owner: org,
        repo: repo,
        per_page: 1
      }
    )
    return runners.total_count
  }

  getSecretsCount = async (org: string, repo: string): Promise<number> => {
    const { data: secrets } = await this.octokit.request(
      'GET /repos/{owner}/{repo}/actions/secrets',
      {
        owner: org,
        repo: repo,
        per_page: 1
      }
    )
    return secrets.total_count
  }

  getVariablesCount = async (org: string, repo: string): Promise<number> => {
    const { data: variables } = await this.octokit.request(
      'GET /repos/{owner}/{repo}/actions/variables',
      {
        owner: org,
        repo: repo,
        per_page: 1
      }
    )
    return variables.total_count
  }

  getEnvironmentsCount = async (org: string, repo: string): Promise<number> => {
    const { data: environments } = await this.octokit.request(
      'GET /repos/{owner}/{repo}/environments',
      {
        owner: org,
        repo: repo,
        per_page: 1
      }
    )
    return environments.total_count || 0
  }

  getWebhooks = async (org: string, repo: string): Promise<Webhook[]> => {
    const webhooks = await this.octokit.paginate(
      'GET /repos/{owner}/{repo}/hooks',
      {
        owner: org,
        repo: repo,
        per_page: 100
      }
    )
    return webhooks.map((hook) => {
      const webhook: Webhook = {
        name: hook.name,
        url: hook.config.url || '',
        active: hook.active,
        last_response: {
          code: hook.last_response.code,
          status: hook.last_response.status,
          message: hook.last_response.message
        }
      }
      return webhook
    })
  }

  getRepoStats = async (org: string, repo: RepoType) => {
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

      const runners = await this.getRunnerCount(org, name)
      const secrets = await this.getSecretsCount(org, name)
      const variables = await this.getVariablesCount(org, name)
      const environments = await this.getEnvironmentsCount(org, name)
      const hooks = this.options.include_hooks
        ? await this.getWebhooks(org, name)
        : null

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

  canCollectData = (): boolean => {
    if (!this.options) {
      return false
    }
    if (!this.octokit) {
      return false
    }
    return true
  }

  convertToCsv = async (file_path: string) => {
    const data = await fs.readFile(file_path, 'utf8')
    const jsonData = JSON.parse(data)

    const csv = json2csv(jsonData, {
      expandArrayObjects: true,
      expandNestedObjects: true
    })

    const csv_file = file_path.replace('.json', '.csv')
    await fs.writeFile(csv_file, csv, 'utf8')
  }

  collectData = async () => {
    if (!this.canCollectData()) {
      throw new Error('Data collection is not configured correctly')
    }

    const output_file = 'results.json'
    if (!output_file) {
      throw new Error('output_file is required')
    }

    await fs.writeFile(output_file, '[\n', 'utf8')

    const orgs = [this.options.org]
    for (const org of orgs) {
      const _repos = this.octokit.paginate.iterator(
        this.octokit.rest.repos.listForOrg,
        {
          org: org,
          per_page: 100
        }
      )

      let first = true
      for await (const { data: repos } of _repos) {
        for (const repo of repos) {
          const result = await this.getRepoStats(org, repo as RepoType)
          console.log(JSON.stringify(result))

          // Write the result to the file incrementally
          const json = JSON.stringify(result, null, 2)
          await fs.appendFile(
            output_file,
            `${first ? '' : ',\n'}${json}`,
            'utf8'
          )
          first = false
        }
      }
    }

    await fs.appendFile(output_file, '\n]', 'utf8')

    if (this.options.output_file_type === 'csv') {
      await this.convertToCsv(output_file)
    }
  }
}

const createCollector = async (
  options: DataCollectOptions
): Promise<CollectData> => {
  const octokit = await createClient(options)
  return new DataCollector(octokit, options)
}

export async function collectData(options: DataCollectOptions): Promise<void> {
  const collector = await createCollector(options)
  await collector.collectData()
}
