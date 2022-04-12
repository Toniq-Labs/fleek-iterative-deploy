import {commitEverythingToCurrentBranch} from './git-commits';
import {
    createFileAndCommitEverythingToNewBranchTest,
    deleteBranchAndGoBackToPreviousBranch,
} from './git-shared-imports-for-testing';

describe(commitEverythingToCurrentBranch.name, () => {
    it('should commit everything to the current branch', async () => {
        const {beforeBranch} = await createFileAndCommitEverythingToNewBranchTest();

        // deleting the branch must be forced to prevent branch "not full merged" errors.
        await deleteBranchAndGoBackToPreviousBranch(beforeBranch, {force: true});
    });
});
