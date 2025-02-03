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

export class DataCollector implements CollectData {
  private octokit: Octokit
  private options: DataCollectOptions

  constructor(octokit: Octokit, options: DataCollectOptions) {
    this.octokit = octokit
    this.options = options
  }

  getRunnerCount = async (org: string, repo: string): Promise<number> => {
    this.options.logMessage(`Getting runners for ${org}/${repo}`, 'debug')

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
    this.options.logMessage(`Getting secrets for ${org}/${repo}`, 'debug')

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
    this.options.logMessage(`Getting variables for ${org}/${repo}`, 'debug')

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
    if (this.options.is_enterprise === false) {
      return 0
    }

    this.options.logMessage(`Getting environments for ${org}/${repo}`, 'debug')

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
    this.options.logMessage(`Getting webhooks for ${org}/${repo}`, 'debug')

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
    this.options.logMessage(`Getting stats for ${org}/${repo.name}`, 'debug')

    let result: RepoStats
    if (repo.archived) {
      this.options.logMessage(
        `Skipping retrieving detailed stats for archived repo ${org}/${repo.name}`,
        'info'
      )

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
      this.options.logMessage(
        `Retrieving detailed stats for repo ${org}/${repo.name}`,
        'info'
      )

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
    this.options.logMessage('Checking if data can be collected', 'info')

    if (!this.options) {
      return false
    }
    if (!this.octokit) {
      return false
    }

    this.options.logMessage('Data can be collected', 'info')
    return true
  }

  convertToCsv = async (file_path: string): Promise<string> => {
    this.options.logMessage('Converting to CSV', 'info')

    const data = await fs.readFile(file_path, 'utf8')
    const jsonData = JSON.parse(data)

    const csv = json2csv(jsonData, {
      expandArrayObjects: true,
      expandNestedObjects: true
    })

    const csv_file = file_path.replace('.json', '.csv')
    await fs.writeFile(csv_file, csv, 'utf8')

    this.options.logMessage('Converted to CSV', 'info')

    return csv_file
  }

  collectData = async (): Promise<string> => {
    this.options.logMessage('Collecting data', 'info')

    if (!this.canCollectData()) {
      throw new Error('Data collection is not configured correctly')
    }

    const json_output_file = 'results.json'
    await fs.writeFile(json_output_file, '[\n', 'utf8')

    const orgs = [this.options.org]
    for (const org of orgs) {
      this.options.logMessage(`Getting repos for ${org}`, 'debug')

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
          this.options.logMessage(JSON.stringify(result), 'debug')

          const json = JSON.stringify(result, null, 2)
          await fs.appendFile(
            json_output_file,
            `${first ? '' : ',\n'}${json}`,
            'utf8'
          )
          first = false
        }
      }
    }

    await fs.appendFile(json_output_file, '\n]', 'utf8')

    if (this.options.output_file_type === 'csv') {
      const csv_output_file = await this.convertToCsv(json_output_file)
      return csv_output_file
    } else {
      return json_output_file
    }
  }
}

const createCollector = async (
  options: DataCollectOptions
): Promise<CollectData> => {
  const octokit = await createClient(options)
  return new DataCollector(octokit, options)
}

export async function collectData(
  options: DataCollectOptions
): Promise<string> {
  const collector = await createCollector(options)
  return await collector.collectData()
}
