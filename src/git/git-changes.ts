import {isTruthy} from 'augment-vir';
import {runShellCommand, toPosixPath} from 'augment-vir/dist/node-only';

export async function getChangesInDirectory(relativeDirectoryPath: string): Promise<string[]> {
    const changes = await getChanges();

    return changes.filter((change) => {
        const [
            ,
            changePath,
        ] = change.split(/\s+/, 2);
        if (!changePath) {
            throw new Error(`Invalid git change split, path is empty from "${change}"`);
        }
        return changePath.startsWith(toPosixPath(relativeDirectoryPath));
    });
}

export async function getChanges(): Promise<string[]> {
    const getChangesCommand = `git status --porcelain=v1 2>/dev/null`;
    const getChangesOutput = await runShellCommand(getChangesCommand, {rejectOnError: true});

    const modifications = getChangesOutput.stdout
        .trim()
        .split('\n')
        // remove potentially empty lines
        .filter(isTruthy);

    return modifications;
}
