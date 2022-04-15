import {isTruthy, safeMatch} from 'augment-vir';
import {runShellCommand, toPosixPath} from 'augment-vir/dist/node-only';
import {existsSync} from 'fs';

export async function getChangesInDirectory(relativeDirectoryPath: string): Promise<Change[]> {
    const changes = await getChanges();

    return changes.filter((change) => {
        return change.currentRelativeFilePath.startsWith(toPosixPath(relativeDirectoryPath));
    });
}

export type Change = {
    fullLine: string;
    fromFilePath?: string | undefined;
    currentRelativeFilePath: string;
    changeType: string;
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
            const fileAndType = getFileAndChangeTypeFromChangeLine(line);
            if (!fileAndType.currentRelativeFilePath) {
                throw new Error(
                    `Invalid extraction ocurred for extracting file name from change line "${line}"`,
                );
            }
            return {
                fullLine: line.trim(),
                changeType: fileAndType.changeType,
                fromFilePath: fileAndType.fromFilePath,
                currentRelativeFilePath: fileAndType.currentRelativeFilePath,
            };
        });

    return modifications;
}

export async function getChangedCurrentFiles(
    relativeDirectoryPath?: string | undefined,
): Promise<string[]> {
    const changes = relativeDirectoryPath
        ? await getChangesInDirectory(relativeDirectoryPath)
        : await getChanges();
    return changes
        .map((change) => change.currentRelativeFilePath)
        .filter((filePath) => {
            return existsSync(filePath);
        });
}

export function getFileAndChangeTypeFromChangeLine(
    changeLine: string,
): Pick<Change, 'fromFilePath' | 'changeType' | 'currentRelativeFilePath'> {
    const [
        ,
        changeType,
        fromFilePath,
        toFilePath,
    ] = safeMatch(changeLine.trim(), /^(\S+)\s+(.+?)(?:$|\s+->\s+(.+)$)/);

    if (!changeType) {
        throw new Error(`Failed to extract changeType from "${changeLine}"`);
    }
    if (!fromFilePath) {
        throw new Error(`Failed to extract fromFilePath from "${changeLine}"`);
    }

    return {
        changeType,
        fromFilePath: toFilePath ? fromFilePath : undefined,
        currentRelativeFilePath: toFilePath ? toFilePath : fromFilePath,
    };
}
