export function getRefBaseName(input: string): string {
    return input.trim().replace('refs/heads/', '');
}
