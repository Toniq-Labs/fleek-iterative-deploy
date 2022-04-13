import {randomString} from 'augment-vir/dist/node-only';
import {relative} from 'path';
import {createNewTestFile} from '../test/create-test-file';
import {
    checkoutBranch,
    createBranch,
    definitelyCheckoutBranch,
    deleteBranch,
    DeleteBranchOptions,
    doesBranchExist,
    getCurrentBranchName,
} from './git-branches';
import {getChanges} from './git-changes';
import {commitEverythingToCurrentBranch} from './git-commits';
import {setFleekIterativeDeployGitUser} from './set-fleek-iterative-deploy-git-user';

export async function createFileAndCommitEverythingToNewBranchTest() {
    // make sure we're clean before running the test
    await expectNoChanges();

    const newBranchName = await createTestBranch();
    const beforeBranch = await getCurrentBranchName();

    await definitelyCheckoutBranch(newBranchName);
    await expectOnBranch(newBranchName);
    const testFilePath = await createNewTestFile();
    await expectChangesToInclude(testFilePath);

    const newCommitMessage = `test commit ${randomString(16)}`;
    await commitEverythingToCurrentBranch(newCommitMessage);

    await expectNoChanges();

    return {
        beforeBranch,
        newBranch: newBranchName,
    };
}

export async function expectBranchExists(branchName: string): Promise<void> {
    expect(await doesBranchExist(branchName)).toBe(true);
}

export async function expectBranchNoExist(branchName: string): Promise<void> {
    expect(await doesBranchExist(branchName)).toBe(false);
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
    const newBranchName = `test-branch-${randomString(8)}`;
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
    const joinedChanges = rawChanges.join('\n');
    filePaths.forEach((filePath) => {
        const relativePath = relative(process.cwd(), filePath);
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
