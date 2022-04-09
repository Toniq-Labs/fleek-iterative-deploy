export function readEnvValue(key: string, keyExplanation: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(`"${keyExplanation}" was not saved in env under "${key}"`);
    }
    return value;
}
