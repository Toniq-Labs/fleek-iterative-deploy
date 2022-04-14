import {checkoutBranch, getCurrentBranchName} from './git-branches';
import {
    commitEverythingToCurrentBranch,
    getHeadCommitHash,
    getLastNCommits,
    makeEmptyCommit,
} from './git-commits';
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
    gitIt('should make an empty commit', async () => {
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

describe(getLastNCommits.name, () => {
    gitIt('should get commits from current branch', async () => {
        const commitCount = 5;
        const commits = await getLastNCommits(commitCount);
        expect(commits.length).toBe(commitCount);
        expect(commits[0]).toBe(await getHeadCommitHash());
    });
});
