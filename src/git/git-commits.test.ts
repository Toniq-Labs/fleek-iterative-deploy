import {commitEverythingToCurrentBranch} from './git-commits';
import {
    createFileAndCommitEverythingToNewBranchTest,
    deleteBranchAndGoBackToPreviousBranch,
    gitIt,
} from './git-shared-imports-for-testing';

describe(commitEverythingToCurrentBranch.name, () => {
    gitIt('should commit everything to the current branch', async () => {
        const {beforeBranch} = await createFileAndCommitEverythingToNewBranchTest();

        // deleting the branch must be forced to prevent branch "not full merged" errors.
        await deleteBranchAndGoBackToPreviousBranch(beforeBranch, {force: true, local: true});
    });
});
