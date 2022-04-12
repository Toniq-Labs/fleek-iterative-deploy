import {runShellCommand} from 'augment-vir/dist/node-only';

export async function getHeadCommitHash(): Promise<string> {
    const getCommitCommand = `git rev-parse HEAD`;
    const getCommitCommandOutput = await runShellCommand(getCommitCommand, {rejectOnError: true});

    const commitHash = getCommitCommandOutput.stdout.trim();
    if (!commitHash) {
        throw new Error(`Got empty commit has for HEAD.`);
    }
    return commitHash;
}

export async function stageEverything(): Promise<void> {
    const addEverythingCommand = `git add .`;
    await runShellCommand(addEverythingCommand, {
        rejectOnError: true,
    });
}

export async function commitEverythingToCurrentBranch(commitMessage: string): Promise<string> {
    await stageEverything();

    const commitCommand = `git commit -m '${commitMessage.replace("'", "\\'")}'`;
    await runShellCommand(commitCommand, {rejectOnError: true});

    return await getHeadCommitHash();
}
