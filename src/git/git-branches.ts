import {isObject, isTruthy, RequiredAndNotNull, typedHasOwnProperty} from 'augment-vir';
import {runShellCommand} from 'augment-vir/dist/node-only';
import {safeInterpolate} from '../augments/shell';
import {getRefBaseName} from './git-shared-imports';

/** At least one must be true. */
export type RemoteOrLocalOptions =
    | {
          remote: boolean;
          remoteName: string;
          local?: undefined | false;
      }
    | {
          remote?: undefined | false;
          remoteName?: undefined | string;
          local: boolean;
      }
    | {
          remote: true;
          remoteName: string;
          local: true;
      };

export const defaultRemoteOrLocalOptions: RequiredAndNotNull<RemoteOrLocalOptions> = {
    local: true,
    remote: false,
    remoteName: 'origin',
};

function assertValidRemoteOrLocalOptions(
    options: unknown,
): asserts options is RemoteOrLocalOptions {
    if (!isObject(options)) {
        throw new Error(`Options input is not an object: "${options}"`);
    }
    const localKey = 'local' as const;
    const isLocal = typedHasOwnProperty(localKey, options) && options[localKey];

    const remoteKey = 'remote' as const;
    const isRemote = typedHasOwnProperty(remoteKey, options) && options[remoteKey];

    const remoteNameKey = 'remoteName' as const;
    const remoteName = typedHasOwnProperty(remoteNameKey, options) && options[remoteNameKey];

    if (!isLocal && !isRemote) {
        throw new Error(`At least remote or local must be set for options.`);
    }

    if (isRemote && !remoteName) {
        throw new Error(`When remote is set, remoteName must also be set`);
    }
}

export async function doesBranchExist(
    branchName: string,
    options: RemoteOrLocalOptions = defaultRemoteOrLocalOptions,
) {
    assertValidRemoteOrLocalOptions(options);

    const branchNames = await listBranchNames(options);

    if (options.local && !branchNames.includes(branchName)) {
        return false;
    }
    if (options.remote && !branchNames.includes(`${options.remoteName}/${branchName}`)) {
        return false;
    }

    return true;
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

export type PushBranchOptions = {
    branchName: string;
    remoteName: string;
};

export async function pushBranch({branchName, remoteName}: PushBranchOptions) {
    const pushBranchCommand = `git push -u ${safeInterpolate(remoteName)} ${safeInterpolate(
        branchName,
    )}:${safeInterpolate(branchName)}`;
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
}> &
    RemoteOrLocalOptions;

export const defaultDeleteBranchOptions: Required<DeleteBranchOptions> = {
    force: false,
    ...defaultRemoteOrLocalOptions,
};

async function deleteLocalBranch(branchName: string, force: boolean): Promise<void> {
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

export type FetchRemoteRefInputs = {
    remoteName: string;
    refName: string;
};

async function fetchRemoteRef(inputs: FetchRemoteRefInputs): Promise<void> {
    const fetchCommand = `git fetch ${safeInterpolate(inputs.remoteName)} ${safeInterpolate(
        inputs.refName,
    )}`;
    const commandResult = await runShellCommand(fetchCommand, {rejectOnError: true});

    if (commandResult.exitCode !== 0) {
        throw new Error(
            `Failed to fetch ref "${inputs.refName}" from remote "${inputs.remoteName}"`,
        );
    }
}

async function deleteRemoteBranch(branchName: string, remoteName: string): Promise<void> {
    if (!doesBranchExist(branchName, {remote: true, remoteName})) {
        throw new Error(
            `Branch "${branchName}" does not exist on remote "${remoteName}" for deletion.`,
        );
    }
    const deleteRemoteBranchCommand = `git push -d ${safeInterpolate(remoteName)} ${safeInterpolate(
        branchName,
    )}`;
    const deleteRemoteBranchCommandOutput = await runShellCommand(deleteRemoteBranchCommand);

    if (deleteRemoteBranchCommandOutput.exitCode !== 0) {
        console.error({deleteBranchCommandOutput: deleteRemoteBranchCommandOutput});
        throw new Error(
            `delete remote branch command failed: "${deleteRemoteBranchCommandOutput.stderr}"`,
        );
    }
}

export async function deleteBranch(
    branchName: string,
    options: DeleteBranchOptions | undefined = defaultDeleteBranchOptions,
): Promise<void> {
    assertValidRemoteOrLocalOptions(options);

    if (options.local) {
        await deleteLocalBranch(branchName, !!options.force);
    }
    if (options.remote) {
        await deleteRemoteBranch(branchName, options.remoteName);
    }
}

export async function listBranchNames(options: RemoteOrLocalOptions): Promise<string[]> {
    assertValidRemoteOrLocalOptions(options);
    const {remote, local, remoteName} = options;

    const pattern = remote
        ? local
            ? // if remote and local branches should be included, don't use a pattern
              ''
            : // if only remote branches are desired, use the remotes pattern
              `refs/remotes/${remoteName}`
        : // if remote branches are excluded, only list local branches.
          'refs/heads';

    const listBranchesCommand = `git for-each-ref --format '%(refname)' ${pattern}`;
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
