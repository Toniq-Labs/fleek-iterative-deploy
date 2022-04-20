import {randomString} from 'augment-vir/dist/node-only';
import {
    createFileAndCommitEverythingToNewBranchTest,
    createTestBranch,
    deleteBranchAndGoBackToPreviousBranch,
    expectBranchExists,
    expectBranchNoExist,
    expectOnBranch,
    gitIt,
} from '../test/git-shared-imports-for-testing';
import {
    checkoutBranch,
    createBranch,
    definitelyCheckoutBranch,
    deleteBranch,
    doesBranchExist,
    getCurrentBranchName,
    hardResetCurrentBranchTo,
    listBranchNames,
    pushBranch,
    rebaseCurrentBranchFromRef,
} from './git-branches';
import {
    cherryPickCommit,
    getCommitDifference,
    getCommitMessage,
    getHeadCommitHash,
    getLastNCommits,
    makeEmptyCommit,
} from './git-commits';

describe(listBranchNames.name, () => {
    gitIt('should list at least the main branch', async () => {
        const branchNames = await listBranchNames({local: true});
        expect(branchNames.length).toBeGreaterThan(0);
        expect(branchNames.includes('main')).toBe(true);
    });

    gitIt(
        'should be able to list remote branches',
        async () => {
            const remoteBranchNames = await listBranchNames({remote: true, remoteName: 'origin'});
            expect(remoteBranchNames.length).toBeGreaterThan(0);
            expect(remoteBranchNames.includes('origin/main')).toBe(true);
        },
        60000,
    );
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
    gitIt(
        'should be able to push a branch',
        async () => {
            const newBranchName = await createTestBranch();
            await expectBranchNoExist(newBranchName, {remote: true, remoteName: 'origin'});

            await pushBranch({branchName: newBranchName, remoteName: 'origin'});
            await expectBranchExists(newBranchName, {remote: true, remoteName: 'origin'});

            await deleteBranch(newBranchName, {local: true, remote: true, remoteName: 'origin'});
            await expectBranchNoExist(newBranchName, {
                local: true,
                remote: true,
                remoteName: 'origin',
            });
        },
        20000,
    );
});

describe(`${rebaseCurrentBranchFromRef.name} and ${pushBranch.name}`, () => {
    const persistentTestBranchName = 'test-branch-persistent';
    const triggerCommitMessage = 'keep this commit!';

    gitIt(
        'should push to a persistent branch and keep matching commit',
        async () => {
            const beforeBranch = await getCurrentBranchName();
            const beforeCommitHash = await getHeadCommitHash();

            try {
                await definitelyCheckoutBranch({
                    branchName: persistentTestBranchName,
                    allowFromRemote: true,
                    remoteName: 'origin',
                });

                const notOnBeforeBranchCommits = await getCommitDifference({
                    notOnThisBranch: beforeBranch,
                    onThisBranch: persistentTestBranchName,
                });
                const newCommitsWithMessages = await Promise.all(
                    notOnBeforeBranchCommits.map(async (commitHash) => {
                        return {
                            message: await getCommitMessage(commitHash),
                            hash: commitHash,
                        };
                    }),
                );

                const originalTriggerCommitHash: undefined | string = newCommitsWithMessages.find(
                    (commitWithMessage) => {
                        return commitWithMessage.message.startsWith(triggerCommitMessage);
                    },
                )?.hash;

                let cherryPickedOriginalTriggerCommitHash = '';

                if (
                    await doesBranchExist(persistentTestBranchName, {
                        remote: true,
                        remoteName: 'origin',
                    })
                ) {
                    await hardResetCurrentBranchTo(beforeBranch, {local: true});

                    if (originalTriggerCommitHash) {
                        cherryPickedOriginalTriggerCommitHash = await cherryPickCommit({
                            commitHash: originalTriggerCommitHash,
                            allowEmpty: true,
                        });
                        expect(await getCommitMessage(await getHeadCommitHash())).toBe(
                            await getCommitMessage(originalTriggerCommitHash),
                        );
                    }
                }

                await expectOnBranch(persistentTestBranchName);

                const newTriggerCommitHash = await makeEmptyCommit(
                    `${triggerCommitMessage} ${randomString(16)}`,
                );

                // make 5 empty commits
                const newCommits: string[] = await Array(5)
                    .fill(0)
                    // reduce must be used here so the commits are made in order and git doesn't
                    // get broken
                    .reduce(async (accum: Promise<string[]>): Promise<string[]> => {
                        const previousCommits = await accum;
                        const commitHash = await makeEmptyCommit(
                            `timestamp: ${new Date().toISOString()}`,
                        );
                        return previousCommits.concat(commitHash);
                    }, [] as string[]);

                const commitCheckLength = originalTriggerCommitHash
                    ? newCommits.length + 3
                    : newCommits.length + 2;

                const latestCommits = await getLastNCommits(commitCheckLength);

                const expectedCommits: string[] = [
                    ...newCommits.reverse(),
                    newTriggerCommitHash,
                    ...(originalTriggerCommitHash ? [cherryPickedOriginalTriggerCommitHash] : []),
                    beforeCommitHash,
                ];

                expect(expectedCommits.length).toBe(commitCheckLength);

                expect(latestCommits).toEqual(expectedCommits);

                await pushBranch({
                    branchName: persistentTestBranchName,
                    remoteName: 'origin',
                    force: true,
                });
                await expectBranchExists(persistentTestBranchName, {
                    remote: true,
                    remoteName: 'origin',
                });

                const afterPushCommits = await getLastNCommits(
                    commitCheckLength,
                    `origin/${persistentTestBranchName}`,
                );

                expect(afterPushCommits).toEqual(expectedCommits);

                await hardResetCurrentBranchTo(beforeBranch, {local: true});

                const cherryPickedNewTriggerCommitHash = await cherryPickCommit({
                    commitHash: newTriggerCommitHash,
                    allowEmpty: true,
                });
                await pushBranch({
                    branchName: persistentTestBranchName,
                    remoteName: 'origin',
                    force: true,
                });
                expect(await getLastNCommits(2, `origin/${persistentTestBranchName}`)).toEqual([
                    cherryPickedNewTriggerCommitHash,
                    beforeCommitHash,
                ]);
            } catch (error) {
                throw error;
            } finally {
                await checkoutBranch(beforeBranch);
                await expectOnBranch(beforeBranch);
                expect(await getHeadCommitHash()).toBe(beforeCommitHash);
            }
        },
        // super long time is for GitHub Actions
        60000,
    );
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

        await definitelyCheckoutBranch({branchName: newBranchName, allowFromRemote: false});
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
        await hardResetCurrentBranchTo(beforeBranch, {local: true});

        const afterResetCommit = await getHeadCommitHash();
        expect(afterResetCommit).not.toBe(beforeResetCommit);

        await deleteBranchAndGoBackToPreviousBranch(beforeBranch);
        const afterGoingBackCommit = await getHeadCommitHash();
        expect(afterGoingBackCommit).toBe(afterResetCommit);
    });
});
