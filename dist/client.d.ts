import { Octokit } from 'octokit';
import { DataCollectOptions } from './types.js';
export declare function createClient(options: DataCollectOptions): Promise<Octokit>;
