import {
    checkoutBranch,
    createBranch,
    definitelyCheckoutBranch,
    deleteBranch,
    getCurrentBranchName,
    hardResetCurrentBranchTo,
    listBranchNames,
} from './git-branches';
import {getHeadCommitHash} from './git-commits';
import {
    createFileAndCommitEverythingToNewBranchTest,
    createTestBranch,
    deleteBranchAndGoBackToPreviousBranch,
    expectBranchNoExist,
    expectOnBranch,
} from './git-shared-imports-for-testing';

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
    it('should create and checkout a branch', async () => {
        const newBranchName = await createTestBranch();
        const beforeBranch = await getCurrentBranchName();

        await definitelyCheckoutBranch(newBranchName);
        await expectOnBranch(newBranchName);

        await deleteBranchAndGoBackToPreviousBranch(beforeBranch);
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
