import { Octokit } from 'octokit';
import { CollectData, DataCollectOptions, RepoStats, RepoType, Webhook } from './types.js';
export declare class DataCollector implements CollectData {
    private octokit;
    private options;
    constructor(octokit: Octokit, options: DataCollectOptions);
    getRunnerCount: (org: string, repo: string) => Promise<number>;
    getSecretsCount: (org: string, repo: string) => Promise<number>;
    getVariablesCount: (org: string, repo: string) => Promise<number>;
    getEnvironmentsCount: (org: string, repo: string) => Promise<number>;
    getWebhooks: (org: string, repo: string) => Promise<Webhook[]>;
    getRepoStats: (org: string, repo: RepoType) => Promise<RepoStats>;
    canCollectData: () => boolean;
    convertToCsv: (file_path: string) => Promise<string>;
    collectData: () => Promise<string>;
}
export declare function collectData(options: DataCollectOptions): Promise<string>;
