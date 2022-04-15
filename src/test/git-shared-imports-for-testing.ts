import {randomString, toPosixPath} from 'augment-vir/dist/node-only';
import {relative} from 'path';
import {
    checkoutBranch,
    createBranch,
    definitelyCheckoutBranch,
    deleteBranch,
    DeleteBranchOptions,
    doesBranchExist,
    getCurrentBranchName,
    RemoteOrLocalOptions,
} from '../git/git-branches';
import {getChanges} from '../git/git-changes';
import {
    commitEverythingToCurrentBranch,
    getCommitDifference,
    getHeadCommitHash,
    getLastNCommits,
} from '../git/git-commits';
import {setFleekIterativeDeployGitUser} from '../git/set-fleek-iterative-deploy-git-user';
import {createNewTestFile} from './create-test-file';

export async function createFileAndCommitEverythingToNewBranchTest() {
    // make sure we're clean before running the test
    await expectNoChanges();

    const beforeBranch = await getCurrentBranchName();
    const newBranchName = await createTestBranch();

    await definitelyCheckoutBranch({branchName: newBranchName, allowFromRemote: false});
    await expectOnBranch(newBranchName);
    const testFilePath = await createNewTestFile();
    await expectChangesToInclude(testFilePath);

    const newCommitMessage = `test commit ${randomString(16)}`;
    const newCommitHash = await commitEverythingToCurrentBranch(newCommitMessage);

    expect(await getHeadCommitHash()).toBe(newCommitHash);
    expect(await getLastNCommits(1)).toEqual([newCommitHash]);
    expect(
        await getCommitDifference({notOnThisBranch: beforeBranch, onThisBranch: newBranchName}),
    ).toEqual([newCommitHash]);

    await expectNoChanges();

    return {
        beforeBranch,
        newBranch: newBranchName,
    };
}

export async function expectBranchExists(
    branchName: string,
    options?: RemoteOrLocalOptions,
): Promise<void> {
    expect(await doesBranchExist(branchName, options)).toBe(true);
}

export async function expectBranchNoExist(
    branchName: string,
    options?: RemoteOrLocalOptions,
): Promise<void> {
    expect(await doesBranchExist(branchName, options)).toBe(false);
}

export async function expectOnBranch(branchName: string): Promise<void> {
    const currentBranch = await getCurrentBranchName();
    expect(currentBranch).toBe(branchName);
}

export async function expectNotOnBranch(branchName: string): Promise<void> {
    const currentBranch = await getCurrentBranchName();
    expect(currentBranch).not.toBe(branchName);
}

export async function expectNoChanges(): Promise<void> {
    const changes = await getChanges();
    expect(changes.length).toBe(0);
}

export async function createTestBranch(): Promise<string> {
    await expectNoChanges();
    const newBranchName = `test-branch-${randomString(16)}`;
    await expectBranchNoExist(newBranchName);

    await createBranch(newBranchName);
    await expectBranchExists(newBranchName);
    await expectNotOnBranch(newBranchName);

    return newBranchName;
}

export async function expectChangesToInclude(filePaths: string[] | string): Promise<void> {
    const rawChanges = await getChanges();
    if (!Array.isArray(filePaths)) {
        filePaths = [filePaths];
    }
    expect(rawChanges.length).toBeGreaterThanOrEqual(filePaths.length);
    const joinedChanges = rawChanges.map((change) => change.currentRelativeFilePath).join('\n');
    filePaths.forEach((filePath) => {
        const relativePath = toPosixPath(relative(process.cwd(), filePath));
        const includes = joinedChanges.includes(relativePath);
        if (!includes) {
            console.error(`changes did not include ${relativePath}`);
            console.error({changes: joinedChanges});
        }
        expect(includes).toBe(true);
    });
}

export async function deleteBranchAndGoBackToPreviousBranch(
    previousBranchName: string,
    deleteBranchOptions?: DeleteBranchOptions,
): Promise<void> {
    const currentBranch = await getCurrentBranchName();

    // go back
    await checkoutBranch(previousBranchName);
    await expectOnBranch(previousBranchName);

    // this needs to get forced to prevent "not fully merged" errors.
    await deleteBranch(currentBranch, deleteBranchOptions);
    await expectBranchNoExist(currentBranch);
}

/** Makes sure a git user is set so that git tests function correctly. */
export function gitIt(
    name: string,
    callback: (() => void | undefined) | (() => Promise<unknown>),
    timeout?: number,
) {
    it(
        name,
        async () => {
            await setFleekIterativeDeployGitUser();
            await callback();
        },
        timeout,
    );
}
