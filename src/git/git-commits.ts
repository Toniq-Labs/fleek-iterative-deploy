import {runShellCommand} from 'augment-vir/dist/node-only';
import {safeInterpolate} from '../augments/shell';
import {getChanges} from './git-changes';

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

    const commitCommand = `git commit -m ${safeInterpolate(commitMessage)}`;
    await runShellCommand(commitCommand, {rejectOnError: true});

    return await getHeadCommitHash();
}

export async function makeEmptyCommit(commitMessage: string): Promise<string> {
    const changes = await getChanges();
    if (changes.length) {
        throw new Error(`Cannot create empty commit, there are current changes.`);
    }

    const commitEmptyCommand = `git commit --allow-empty -m ${safeInterpolate(commitMessage)}`;
    await runShellCommand(commitEmptyCommand, {rejectOnError: true});

    return await getHeadCommitHash();
}
