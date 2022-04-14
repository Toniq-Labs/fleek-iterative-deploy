export function safeInterpolate(input: string): string {
    if (input === '') {
        return '';
    }
    return `'${input.replace("'", `'"'"'`)}'`;
}
