import {
    checkoutBranch,
    createBranch,
    definitelyCheckoutBranch,
    deleteBranch,
    getCurrentBranchName,
    hardResetCurrentBranchTo,
    listBranchNames,
    pushBranch,
} from './git-branches';
import {getHeadCommitHash} from './git-commits';
import {
    createFileAndCommitEverythingToNewBranchTest,
    createTestBranch,
    deleteBranchAndGoBackToPreviousBranch,
    expectBranchExists,
    expectBranchNoExist,
    expectOnBranch,
    gitIt,
} from './git-shared-imports-for-testing';

describe(listBranchNames.name, () => {
    gitIt('should list at least the main branch', async () => {
        const branchNames = await listBranchNames({local: true});
        expect(branchNames.length).toBeGreaterThan(0);
        expect(branchNames.includes('main')).toBe(true);
    });

    gitIt('should be able to list remote branches', async () => {
        const remoteBranchNames = await listBranchNames({remote: true, remoteName: 'origin'});
        expect(remoteBranchNames.length).toBeGreaterThan(0);
        expect(remoteBranchNames.includes('origin/main')).toBe(true);
    });
});

describe(getCurrentBranchName.name, () => {
    gitIt('should be included in the list of branch names', async () => {
        const currentBranch = await getCurrentBranchName();
        const allBranches = await listBranchNames({local: true});

        expect(allBranches.includes(currentBranch)).toBe(true);
    });
});

describe(`${createBranch.name} and ${deleteBranch.name}`, () => {
    gitIt('should create and delete a new branch', async () => {
        const newBranchName = await createTestBranch();

        await deleteBranch(newBranchName);
        await expectBranchNoExist(newBranchName);
    });
});

describe(pushBranch.name, () => {
    gitIt('should be able to push a branch', async () => {
        const newBranchName = await createTestBranch();
        await expectBranchNoExist(newBranchName, {remote: true, remoteName: 'origin'});

        await pushBranch({branchName: newBranchName, remoteName: 'origin'});
        await expectBranchExists(newBranchName, {remote: true, remoteName: 'origin'});

        await deleteBranch(newBranchName, {local: true, remote: true, remoteName: 'origin'});
        await expectBranchNoExist(newBranchName, {local: true, remote: true, remoteName: 'origin'});
    });
});

describe(checkoutBranch.name, () => {
    gitIt('should be able to checkout a new branch', async () => {
        const newBranchName = await createTestBranch();
        const beforeCheckoutBranch = await getCurrentBranchName();

        await checkoutBranch(newBranchName);
        await expectOnBranch(newBranchName);

        await deleteBranchAndGoBackToPreviousBranch(beforeCheckoutBranch);
    });
});

describe(definitelyCheckoutBranch.name, () => {
    gitIt('should create and checkout a branch', async () => {
        const newBranchName = await createTestBranch();
        const beforeBranch = await getCurrentBranchName();

        await definitelyCheckoutBranch(newBranchName);
        await expectOnBranch(newBranchName);

        await deleteBranchAndGoBackToPreviousBranch(beforeBranch);
    });
});

describe(hardResetCurrentBranchTo.name, () => {
    gitIt('should reset a new branch', async () => {
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
