export interface DataCollectOptions {
    org: string;
    api_url: string;
    auth_type: string;
    token: string | undefined;
    is_debug: boolean | undefined;
    client_id: string | undefined;
    client_secret: string | undefined;
    app_id: string | undefined;
    app_private_key: string | undefined;
    app_installation_id: string | undefined;
}
export declare function collectData(options: DataCollectOptions): Promise<void>;
