import { components } from '@octokit/openapi-types'

export interface Webhook {
  name: string
  url: string
  active: boolean
  last_response: {
    code: number | null
    status: string | null
    message: string | null
  }
}

export interface RepoStats {
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

export type RepoType = components['schemas']['repository']

export type AuthType = 'default' | 'app' | 'installation' | 'token'

export interface DataCollectOptions {
  org: string
  api_url: string
  auth_type: AuthType
  token: string | undefined
  is_debug: boolean | undefined
  client_id: string | undefined
  client_secret: string | undefined
  app_id: string | undefined
  app_private_key: string | undefined
  app_installation_id: string | undefined
  include_hooks: boolean | undefined
  output_csv: boolean | undefined
}
