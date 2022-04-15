export type EnvKey = {
    key: string;
    name: string;
    failWhenMissing: boolean;
};

export const fleekApiEnvKey: EnvKey = {
    key: 'FLEEK_API_KEY',
    name: 'Fleek API key',
    failWhenMissing: true,
};
export const fleekTeamIdEnvKey: EnvKey = {
    key: 'FLEEK_TEAM_ID',
    name: 'Fleek team id',
    failWhenMissing: true,
};
export const fleekSiteIdEnvKey: EnvKey = {
    key: 'FLEEK_SITE_ID',
    name: 'Fleek site id',
    failWhenMissing: true,
};
export const githubRef: EnvKey = {
    key: 'GITHUB_REF',
    name: 'GitHub Action trigger ref',
    failWhenMissing: false,
};

export function checkEnvVar(key: EnvKey): void {
    readEnvVar(key);
}

export function readEnvVar(key: EnvKey): string {
    const value = process.env[key.key];
    if (key.failWhenMissing && !value) {
        throw new Error(`"${key.name}" was not saved in env under "${key.key}"`);
    }
    return value ?? '';
}
