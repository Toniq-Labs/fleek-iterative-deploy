import {isTruthy} from 'augment-vir';
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

export async function getLastNCommits(
    commitCount: number,
    refName: string = '',
): Promise<string[]> {
    const lastNCommitsCommand = `git log ${safeInterpolate(refName)} -n ${safeInterpolate(
        String(commitCount),
    )} --pretty=format:"%H"`;

    const commandResults = await runShellCommand(lastNCommitsCommand, {rejectOnError: true});

    return commandResults.stdout
        .trim()
        .split('\n')
        .map((line) => line.trim())
        .filter(isTruthy);
}

export type GetCommitDifferenceInputs = {
    /** We will get commits that are on this branch but not on the other branch. */
    onThisBranch: string;
    /** We will get commits that are NOT on this branch but are on the other branch. */
    notOnThisBranch: string;
};

export async function getCommitDifference(inputs: GetCommitDifferenceInputs): Promise<string[]> {
    const commandString = `git log ${safeInterpolate(inputs.onThisBranch)} ^${
        inputs.notOnThisBranch
    } --pretty=format:"%H"`;

    const commandResult = await runShellCommand(commandString, {rejectOnError: true});

    return commandResult.stdout
        .trim()
        .split('\n')
        .map((line) => line.trim())
        .filter(isTruthy);
}
