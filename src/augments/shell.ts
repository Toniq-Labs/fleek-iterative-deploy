export function safeInterpolate(input: string): string {
    return `'${input.replace("'", `'"'"'`)}'`;
}
