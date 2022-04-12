import {isTruthy} from 'augment-vir';
import {runShellCommand} from 'augment-vir/dist/node-only';

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

    console.log(`Get current branch command output:`);
    console.log(getCurrentBranchCommandOutput);

    return getRefBaseName(getCurrentBranchCommandOutput.stdout);
}

export async function pushCurrentBranch() {
    const currentBranchName = await getCurrentBranchName();

    const pushBranchCommand = `git push -u origin ${currentBranchName}:${currentBranchName}`;
    const pushBranchCommandOutput = await runShellCommand(pushBranchCommand);

    if (pushBranchCommandOutput.exitCode !== 0) {
        throw new Error(`Failed to push branch: ${pushBranchCommandOutput.stderr}`);
    }
}

export async function hardResetCurrentBranchTo(resetToThisBranchName: string): Promise<void> {
    const resetBranchCommand = `git reset --hard ${resetToThisBranchName}`;
    await runShellCommand(resetBranchCommand, {rejectOnError: true});
}

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
        return changePath.startsWith(relativeDirectoryPath);
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

// returns new commit's hash
export async function commitEverythingToCurrentBranch(commitMessage: string): Promise<string> {
    await stageEverything();

    const commitCommand = `git commit -m '${commitMessage.replace("'", "\\'")}'`;
    await runShellCommand(commitCommand, {rejectOnError: true});

    return await getHeadCommitHash();
}

export async function checkoutBranch(branchName: string): Promise<void> {
    const checkoutBranchCommand = `git checkout ${branchName}`;
    await runShellCommand(checkoutBranchCommand, {rejectOnError: true});
}

export async function createBranch(newBranchName: string): Promise<void> {
    const createBranchCommand = `git branch ${newBranchName}`;
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
    const deleteBranchCommand = `git branch -d ${branchName} ${force ? '-f' : ''}`;
    const deleteBranchCommandOutput = await runShellCommand(deleteBranchCommand);

    if (deleteBranchCommandOutput.exitCode !== 0) {
        console.error({deleteBranchCommandOutput});
        throw new Error(`delete branch command failed: ${deleteBranchCommandOutput.stderr}`);
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

function getRefBaseName(input: string): string {
    return input.trim().replace('refs/heads/', '');
}
