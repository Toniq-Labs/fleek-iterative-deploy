export type EnvKey = {
    key: string;
    name: string;
};

export const fleekApiEnvKey: EnvKey = {
    key: 'FLEEK_API_KEY',
    name: 'Fleek API key',
};
export const fleekTeamIdEnvKey: EnvKey = {
    key: 'FLEEK_TEAM_ID',
    name: 'Fleek team id',
};
export const fleekSiteIdEnvKey: EnvKey = {
    key: 'FLEEK_SITE_ID',
    name: 'Fleek site id',
};

export function checkEnvVar(key: EnvKey): void {
    readEnvVar(key);
}

export function readEnvVar(key: EnvKey): string {
    const value = process.env[key.key];
    if (!value) {
        throw new Error(`"${key.name}" was not saved in env under "${key.key}"`);
    }
    return value;
}
