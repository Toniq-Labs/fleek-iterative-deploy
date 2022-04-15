import {isTruthy} from 'augment-vir';
import {runShellCommand, toPosixPath} from 'augment-vir/dist/node-only';

export async function getChangesInDirectory(relativeDirectoryPath: string): Promise<Change[]> {
    const changes = await getChanges();

    return changes.filter((change) => {
        return change.relativeFilePath.startsWith(toPosixPath(relativeDirectoryPath));
    });
}

export type Change = {
    fullLine: string;
    relativeFilePath: string;
};

export async function getChanges(): Promise<Change[]> {
    const getChangesCommand = `git status --porcelain=v1 2>/dev/null`;
    const getChangesOutput = await runShellCommand(getChangesCommand, {rejectOnError: true});

    const modifications: Change[] = getChangesOutput.stdout
        .trim()
        .split('\n')
        // remove potentially empty lines
        .filter(isTruthy)
        .map((line): Change => {
            const fileName = extractFileNameFromChangeLine(line);
            if (!fileName) {
                throw new Error(
                    `Invalid extraction ocurred for extracting file name from change line "${line}"`,
                );
            }
            return {
                fullLine: line.trim(),
                relativeFilePath: fileName,
            };
        });

    return modifications;
}

export function extractFileNameFromChangeLine(changeLine: string): string {
    return changeLine
        .trim()
        .replace(/^\S+\s+?/, '')
        .trim();
}
