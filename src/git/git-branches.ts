import {isTruthy} from 'augment-vir';
import {runShellCommand} from 'augment-vir/dist/node-only';
import {safeInterpolate} from '../augments/shell';
import {getRefBaseName} from './git-shared-imports';

export async function doesBranchExist(branchName: string) {
    const branchNames = await listBranchNames();
    return branchNames.includes(branchName);
}

/** If the given branch name does not exist, create it. Then checkout the given branch name. */
export async function definitelyCheckoutBranch(branchName: string): Promise<void> {
    if (!doesBranchExist(branchName)) {
        await createBranch(branchName);
    }
    await checkoutBranch(branchName);
}

export async function getCurrentBranchName(): Promise<string> {
    const getCurrentBranchCommand = `git symbolic-ref -q HEAD`;
    const getCurrentBranchCommandOutput = await runShellCommand(getCurrentBranchCommand);

    return getRefBaseName(getCurrentBranchCommandOutput.stdout);
}

export async function pushCurrentBranch() {
    const currentBranchName = await getCurrentBranchName();

    const pushBranchCommand = `git push -u origin ${safeInterpolate(
        currentBranchName,
    )}:${safeInterpolate(currentBranchName)}`;
    const pushBranchCommandOutput = await runShellCommand(pushBranchCommand);

    if (pushBranchCommandOutput.exitCode !== 0) {
        throw new Error(`Failed to push branch: ${pushBranchCommandOutput.stderr}`);
    }
}

export async function hardResetCurrentBranchTo(resetToThisBranchName: string): Promise<void> {
    const resetBranchCommand = `git reset --hard ${safeInterpolate(resetToThisBranchName)}`;
    await runShellCommand(resetBranchCommand, {rejectOnError: true});
}

export async function checkoutBranch(branchName: string): Promise<void> {
    const checkoutBranchCommand = `git checkout ${safeInterpolate(branchName)}`;
    await runShellCommand(checkoutBranchCommand, {rejectOnError: true});
}

export async function createBranch(newBranchName: string): Promise<void> {
    const createBranchCommand = `git branch ${safeInterpolate(newBranchName)}`;
    await runShellCommand(createBranchCommand, {rejectOnError: true});
}

export type DeleteBranchOptions = Partial<{
    force: boolean;
}>;

export const defaultDeleteBranchOptions: Required<DeleteBranchOptions> = {
    force: false,
};

export async function deleteBranch(
    branchName: string,
    {
        force = defaultDeleteBranchOptions.force,
    }: DeleteBranchOptions | undefined = defaultDeleteBranchOptions,
): Promise<void> {
    if (!doesBranchExist(branchName)) {
        throw new Error(`Branch "${branchName}" does not exist for deletion.`);
    }
    const deleteBranchCommand = `git branch -d ${safeInterpolate(branchName)} ${force ? '-f' : ''}`;
    const deleteBranchCommandOutput = await runShellCommand(deleteBranchCommand);

    if (deleteBranchCommandOutput.exitCode !== 0) {
        console.error({deleteBranchCommandOutput});
        throw new Error(`delete branch command failed: "${deleteBranchCommandOutput.stderr}"`);
    }
}

export async function listBranchNames(): Promise<string[]> {
    const listBranchesCommand = `git for-each-ref --format '%(refname)' refs/heads`;
    const listBranchesCommandOutput = await runShellCommand(listBranchesCommand, {
        rejectOnError: true,
    });

    return (
        listBranchesCommandOutput.stdout
            .trim()
            .split('\n')
            // remove potentially empty lines
            .filter(isTruthy)
            .map(getRefBaseName)
    );
}
