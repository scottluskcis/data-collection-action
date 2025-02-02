import { Octokit } from 'octokit'
import { createAppAuth } from '@octokit/auth-app'
import { createTokenAuth } from '@octokit/auth-token'
import { DataCollectOptions } from './types.js'

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

export async function createClient(
  options: DataCollectOptions
): Promise<Octokit> {
  if (!options) {
    throw new Error('options are required')
  }

  const { authStrategy, auth } = getAuthConfig(options)
  const octokitOptions = {
    authStrategy,
    auth
  }

  return new Octokit(octokitOptions)
}
