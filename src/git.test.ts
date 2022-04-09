import {randomString} from 'augment-vir/dist/node-only';
import {existsSync} from 'fs';
import {remove} from 'fs-extra';
import {readdir, unlink} from 'fs/promises';
import {dirname, relative} from 'path';
import {directoryForFleekIterativeDeployFiles} from './file-paths';
import {
    checkoutBranch,
    commitEverythingToCurrentBranch,
    createBranch,
    definitelyCheckoutBranch,
    deleteBranch,
    DeleteBranchOptions,
    doesBranchExist,
    getChanges,
    getChangesInDirectory,
    getCurrentBranchName,
    getHeadCommitHash,
    hardResetCurrentBranchTo,
    listBranchNames,
    stageEverything,
} from './git';
import {createNewTestFile} from './test/create-test-file';

async function expectBranchExists(branchName: string): Promise<void> {
    expect(await doesBranchExist(branchName)).toBe(true);
}

async function expectBranchNoExist(branchName: string): Promise<void> {
    expect(await doesBranchExist(branchName)).toBe(false);
}

async function expectOnBranch(branchName: string): Promise<void> {
    const currentBranch = await getCurrentBranchName();
    expect(currentBranch).toBe(branchName);
}

async function expectNotOnBranch(branchName: string): Promise<void> {
    const currentBranch = await getCurrentBranchName();
    expect(currentBranch).not.toBe(branchName);
}

async function expectNoChanges(): Promise<void> {
    const changes = await getChanges();
    expect(changes.length).toBe(0);
}

async function createTestBranch(): Promise<string> {
    const newBranchName = `test-branch-${randomString(8)}`;
    await expectBranchNoExist(newBranchName);

    await createBranch(newBranchName);
    await expectBranchExists(newBranchName);
    await expectNotOnBranch(newBranchName);

    return newBranchName;
}

async function expectChangesToInclude(filePaths: string[] | string): Promise<void> {
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

async function deleteBranchAndGoBackToPreviousBranch(
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

describe(listBranchNames.name, () => {
    it('should list at least the main branch', async () => {
        const branchNames = await listBranchNames();
        expect(branchNames.length).toBeGreaterThan(0);
        expect(branchNames.includes('main')).toBe(true);
    });
});

describe(getCurrentBranchName.name, () => {
    it('should be included in the list of branch names', async () => {
        const currentBranch = await getCurrentBranchName();
        const allBranches = await listBranchNames();

        expect(allBranches.includes(currentBranch)).toBe(true);
    });
});

describe(`${createBranch.name} and ${deleteBranch.name}`, () => {
    it('should create and delete a new branch', async () => {
        const newBranchName = await createTestBranch();

        await deleteBranch(newBranchName);
        await expectBranchNoExist(newBranchName);
    });
});

describe(checkoutBranch.name, () => {
    it('should be able to checkout a new branch', async () => {
        const newBranchName = await createTestBranch();
        const beforeCheckoutBranch = await getCurrentBranchName();

        await checkoutBranch(newBranchName);
        await expectOnBranch(newBranchName);

        await deleteBranchAndGoBackToPreviousBranch(beforeCheckoutBranch);
    });
});

describe(definitelyCheckoutBranch.name, () => {
    it('should be able to checkout a new branch', async () => {
        const newBranchName = await createTestBranch();
        const beforeBranch = await getCurrentBranchName();

        await definitelyCheckoutBranch(newBranchName);
        await expectOnBranch(newBranchName);

        await deleteBranchAndGoBackToPreviousBranch(beforeBranch);
    });
});

describe(getChanges, () => {
    it('should show changes', async () => {
        await expectNoChanges();

        const testFilePath = await createNewTestFile();
        const afterCreationChanges = await getChanges();
        expect(afterCreationChanges.length).toBe(1);
        await expectChangesToInclude(testFilePath);

        await unlink(testFilePath);
        expect(existsSync(testFilePath)).toBe(false);

        await expectNoChanges();
    });
});

async function createFileAndCommitEverythingToNewBranchTest() {
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

describe(commitEverythingToCurrentBranch.name, () => {
    it('should commit everything to the current branch', async () => {
        const {beforeBranch} = await createFileAndCommitEverythingToNewBranchTest();

        // deleting the branch must be forced to prevent branch "not full merged" errors.
        await deleteBranchAndGoBackToPreviousBranch(beforeBranch, {force: true});
    });
});

describe(hardResetCurrentBranchTo.name, () => {
    it('should reset a new branch', async () => {
        const {beforeBranch, newBranch} = await createFileAndCommitEverythingToNewBranchTest();

        const beforeResetCommit = await getHeadCommitHash();
        // double check we're not on the main branch
        expect(beforeBranch).not.toBe(newBranch);
        await hardResetCurrentBranchTo(beforeBranch);

        const afterResetCommit = await getHeadCommitHash();
        expect(afterResetCommit).not.toBe(beforeResetCommit);

        await deleteBranchAndGoBackToPreviousBranch(beforeBranch);
        const afterGoingBackCommit = await getHeadCommitHash();
        expect(afterGoingBackCommit).toBe(afterResetCommit);
    });
});

describe(getChangesInDirectory.name, () => {
    it('should only return changes for the given directory', async () => {
        function getPathJustBeforeDeployFilesDir(input: string): string {
            const dir = dirname(input);
            if (dir === '/' || dir === '.' || !dir) {
                throw new Error(
                    `Could not find parent dir right before deploy files dir for "${input}"`,
                );
            }
            if (dir === directoryForFleekIterativeDeployFiles) {
                return input;
            } else {
                return getPathJustBeforeDeployFilesDir(dir);
            }
        }

        // make sure we're clean before running the test
        await expectNoChanges();

        const beforeContentsCount = (await readdir(directoryForFleekIterativeDeployFiles)).length;

        // just for the `.gitkeep` file
        expect(beforeContentsCount).toBe(1);

        const testFiles: string[] = await Promise.all(
            [
                2,
                3,
                5,
            ].map(async (subDirCount) => {
                return await createNewTestFile(subDirCount);
            }),
        );

        const afterCreationContentsCount = (await readdir(directoryForFleekIterativeDeployFiles))
            .length;

        expect(afterCreationContentsCount).toBe(beforeContentsCount + testFiles.length);
        // stage everything before checking changes so we get the full file path for each change

        await stageEverything();

        await expectChangesToInclude(testFiles);

        await Promise.all(
            testFiles.map(async (testFilePath) => {
                const testFileDirectory = dirname(testFilePath);
                expect(testFileDirectory).not.toBe(directoryForFleekIterativeDeployFiles);

                const relativeDir = relative(process.cwd(), testFileDirectory);
                const dirChanges = await getChangesInDirectory(relativeDir);
                if (dirChanges.length !== 1) {
                    console.error({testFilePath, relativeDir, changes: await getChanges()});
                }
                expect(dirChanges.length).toBe(1);
            }),
        );

        await Promise.all(
            testFiles.map(async (testFilePath) => {
                expect(existsSync(testFilePath)).toBe(true);
                const deployFilesSubDir = getPathJustBeforeDeployFilesDir(testFilePath);
                expect(existsSync(deployFilesSubDir)).toBe(true);
                await remove(deployFilesSubDir);
                expect(existsSync(deployFilesSubDir)).toBe(false);
            }),
        );

        // stage all the file deletions so we cancel out the previous additions
        await stageEverything();

        const afterDeletionContentsCount = (await readdir(directoryForFleekIterativeDeployFiles))
            .length;

        expect(afterDeletionContentsCount).toBe(beforeContentsCount);
    });
});
