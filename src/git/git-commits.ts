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

export type CommitInputs =
    | {
          commitMessage: string;
          amend?: boolean;
          noEdit?: false | undefined;
          resetAuthor?: boolean;
      }
    | {
          commitMessage?: undefined;
          amend?: boolean;
          noEdit: true;
          resetAuthor?: boolean;
      };

export async function commitEverythingToCurrentBranch(inputs: CommitInputs): Promise<string> {
    await stageEverything();

    const amend = inputs.amend ? ' --amend' : '';
    const noEdit = inputs.noEdit ? ' --no-edit' : '';
    const message = inputs.noEdit ? '' : ` -m ${safeInterpolate(inputs.commitMessage)}`;
    const resetAuthor = inputs.resetAuthor ? ' --reset-author' : '';

    const commitCommand = `git commit${amend}${noEdit}${resetAuthor}${message}`;
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
    const commandString = `git log ${safeInterpolate(inputs.onThisBranch)} ^${safeInterpolate(
        inputs.notOnThisBranch,
    )} --pretty=format:"%H"`;

    console.log(`hash of ${inputs.onThisBranch}: ${await getRefHash(inputs.onThisBranch)}`);
    console.log(`hash of ${inputs.notOnThisBranch}: ${await getRefHash(inputs.notOnThisBranch)}`);
    console.log(commandString);

    const commandResult = await runShellCommand(commandString, {rejectOnError: true});

    return commandResult.stdout
        .trim()
        .split('\n')
        .map((line) => line.trim())
        .filter(isTruthy);
}

export async function getRefHash(refName: string): Promise<string> {
    const command = `git rev-parse ${safeInterpolate(refName)}`;
    const output = await runShellCommand(command, {rejectOnError: true});

    return output.stdout.trim();
}

export async function getCommitMessage(refName: string): Promise<string> {
    const getCommitMessageCommand = `git log -1 --pretty=format:"%B" ${safeInterpolate(refName)}`;
    const getCommitMessageCommandOutput = await runShellCommand(getCommitMessageCommand, {
        rejectOnError: true,
    });

    return getCommitMessageCommandOutput.stdout.trim();
}

export type CherryPickInputs = {
    allowEmpty?: boolean;
    commitHash: string;
    stageOnly?: boolean;
    acceptAllCherryPickChanges?: boolean;
};

/** Returns the new head hash. */
export async function cherryPickCommit(inputs: CherryPickInputs): Promise<string> {
    const allowEmpty = inputs.allowEmpty ? ' --allow-empty' : '';
    const stageOnly = inputs.stageOnly ? ' -n' : '';
    const forceCherryPick = inputs.acceptAllCherryPickChanges ? ' -X theirs' : '';

    const cherryPickCommand = `git cherry-pick${allowEmpty}${stageOnly}${forceCherryPick} ${safeInterpolate(
        inputs.commitHash,
    )}`;
    await runShellCommand(cherryPickCommand, {rejectOnError: true});

    return getHeadCommitHash();
}
