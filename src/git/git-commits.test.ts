import {checkoutBranch, getCurrentBranchName} from './git-branches';
import {commitEverythingToCurrentBranch, getHeadCommitHash, makeEmptyCommit} from './git-commits';
import {
    createFileAndCommitEverythingToNewBranchTest,
    createTestBranch,
    deleteBranchAndGoBackToPreviousBranch,
    expectBranchExists,
    expectNotOnBranch,
    expectOnBranch,
    gitIt,
} from './git-shared-imports-for-testing';

describe(commitEverythingToCurrentBranch.name, () => {
    gitIt('should commit everything to the current branch', async () => {
        const {beforeBranch} = await createFileAndCommitEverythingToNewBranchTest();

        // deleting the branch must be forced to prevent branch "not full merged" errors.
        await deleteBranchAndGoBackToPreviousBranch(beforeBranch, {force: true, local: true});
    });
});

describe(makeEmptyCommit.name, () => {
    it('should make an empty commit', async () => {
        const newBranch = await createTestBranch();
        await expectNotOnBranch(newBranch);
        await expectBranchExists(newBranch);
        const beforeBranch = await getCurrentBranchName();

        await checkoutBranch(newBranch);
        await expectOnBranch(newBranch);

        const beforeHeadHash = await getHeadCommitHash();
        expect(beforeHeadHash).toBeTruthy();

        const newHash = await makeEmptyCommit('test commit');
        const afterCommitHash = await getHeadCommitHash();
        expect(expect(afterCommitHash)).not.toBe(beforeHeadHash);
        expect(expect(newHash)).not.toBe(afterCommitHash);

        await deleteBranchAndGoBackToPreviousBranch(beforeBranch, {force: true, local: true});
    });
});
