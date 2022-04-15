import {runShellCommand} from 'augment-vir/dist/node-only';
import {copy, ensureDir, remove} from 'fs-extra';
import {readdir} from 'fs/promises';
import {join, relative} from 'path';
import {divideArray} from './augments/array';
import {copyFilesToDir, removeMatchFromFile} from './augments/fs';
import {buildOutputForCopyingFrom, readmeForIterationBranchFile} from './file-paths';
import {waitUntilAllDeploysAreFinished, waitUntilFleekDeployStarted} from './fleek';
import {
    checkoutBranch,
    definitelyCheckoutBranch,
    getCurrentBranchName,
    hardResetCurrentBranchTo,
    pushBranch,
    updateAllFromRemote,
} from './git/git-branches';
import {getChangedCurrentFiles} from './git/git-changes';
import {
    cherryPickCommit,
    commitEverythingToCurrentBranch,
    getCommitDifference,
    getCommitMessage,
    getHeadCommitHash,
    stageEverything,
} from './git/git-commits';
import {setFleekIterativeDeployGitUser} from './git/set-fleek-iterative-deploy-git-user';

export type DeployIterativelyInputs = {
    buildOutputBranchName: string;
    buildCommand: string;
    triggerBranch: string;
    fleekDeployDir: string;
    filesPerUpload: number;
    gitRemoteName: string;
};

const allBuildOutputCommitMessage = 'add all build output';

export async function deployIteratively({
    buildOutputBranchName,
    buildCommand,
    triggerBranch,
    fleekDeployDir,
    filesPerUpload,
    gitRemoteName,
}: DeployIterativelyInputs) {
    const totalStartTimeMs: number = Date.now();

    const fullFleekDeployDirPath = join(process.cwd(), fleekDeployDir);

    await setFleekIterativeDeployGitUser();

    await updateAllFromRemote();

    console.info(`Checking out "${triggerBranch}"`);
    await checkoutBranch(triggerBranch);

    const triggerBranchName = await getCurrentBranchName();
    if (!triggerBranchName) {
        throw new Error(`Could not find current branch name.`);
    }
    console.info({triggerBranchName});
    const triggerBranchHeadHash = await getHeadCommitHash();
    const triggerBranchHeadMessage = await getCommitMessage(triggerBranchHeadHash);
    console.info(`on commit:
    ${triggerBranchHeadHash}
with message:
    ${triggerBranchHeadMessage}`);

    console.info(`Checking out ${buildOutputBranchName}`);
    await definitelyCheckoutBranch({
        branchName: buildOutputBranchName,
        allowFromRemote: true,
        remoteName: gitRemoteName,
    });
    const buildOutputBranchHeadHash = await getHeadCommitHash();
    const buildOutputBranchHeadMessage = await getCommitMessage(buildOutputBranchHeadHash);
    console.info(`Now on branch:
    ${await getCurrentBranchName()}
commit:
    ${buildOutputBranchHeadHash}
message:
    ${buildOutputBranchHeadMessage}`);

    const previousBuildCommits = await getCommitDifference({
        notOnThisBranch: triggerBranchName,
        onThisBranch: buildOutputBranchName,
    });
    console.info(`previous build commits:
    ${previousBuildCommits.join('\n    ')}`);

    const previousBuildCommitsWithMessages = await Promise.all(
        previousBuildCommits.map(async (commitHash) => {
            return {
                message: await getCommitMessage(commitHash),
                hash: commitHash,
            };
        }),
    );
    const lastFullBuildCommits = previousBuildCommitsWithMessages.filter((commitWithMessage) => {
        return commitWithMessage.message.startsWith(allBuildOutputCommitMessage);
    });
    console.info({lastFullBuildCommits});
    console.info(
        `Resetting current branch ("${await getCurrentBranchName()}") to trigger branch "${triggerBranchName}" to get latest changes.`,
    );
    await hardResetCurrentBranchTo(triggerBranchName, {
        remote: true,
        remoteName: gitRemoteName,
    });

    await lastFullBuildCommits
        // reverse so we apply the commits in the order they were originally applied
        .reverse()
        // use reduce here so that commits don't run in parallel
        .reduce(async (lastPromise, buildCommit, index) => {
            await lastPromise;
            console.info(`cherry-picking build commit:
    ${buildCommit.hash}
with commit message:
    ${buildCommit.message}`);
            const cherryPickExtraOptions =
                index === 0
                    ? {}
                    : {
                          stageOnly: true,
                      };

            // full cherry pick the first full build commit
            await cherryPickCommit({
                commitHash: buildCommit.hash,
                ...cherryPickExtraOptions,
            });

            if (index > 0) {
                // only stage cherry-pick the following commits and then amend them into the first
                await commitEverythingToCurrentBranch({
                    amend: true,
                    noEdit: true,
                });
            }
        }, Promise.resolve());

    console.info(`Running build command: ${buildCommand}`);
    const buildCommandOutput = await runShellCommand(buildCommand, {
        stderrCallback: (buffer) => console.error(buffer.toString()),
        stdoutCallback: (buffer) => console.info(buffer.toString()),
    });

    const fileCountInFleekDeployDir = (await readdir(fullFleekDeployDirPath)).length;
    console.info(
        `Build done. "${fileCountInFleekDeployDir}" files now in fleek deploy dir "${fullFleekDeployDirPath}"`,
    );

    if (buildCommandOutput.exitCode !== 0) {
        throw new Error(
            `Build command failed with exit code ${buildCommandOutput.exitCode}: ${buildCommandOutput.stderr}`,
        );
    }
    console.info(`Copying over README.md file now...`);
    await copy(readmeForIterationBranchFile, 'README.md');

    console.info(`Clearing the temporary build output directory "${buildOutputForCopyingFrom}"`);
    // clear out the directory we'll be copying from
    await remove(buildOutputForCopyingFrom);
    await ensureDir(buildOutputForCopyingFrom);
    console.info(`Copying "${fullFleekDeployDirPath}" to "${buildOutputForCopyingFrom}"`);
    // put all the build output into the directory we'll copy from
    await copy(fullFleekDeployDirPath, buildOutputForCopyingFrom);

    const fileCountInBuildOutputForCopyingFrom = (await readdir(buildOutputForCopyingFrom)).length;
    console.info(
        `Copying done: "${fileCountInBuildOutputForCopyingFrom}" files are in "${buildOutputForCopyingFrom}" now.`,
    );

    console.info(`Clearing "${fullFleekDeployDirPath}"`);
    await remove(fullFleekDeployDirPath);
    await ensureDir(fullFleekDeployDirPath);

    const relativeCopyFromDir = relative(process.cwd(), buildOutputForCopyingFrom);

    console.info(`Getting changes in "${relativeCopyFromDir}"`);
    await stageEverything();
    const changes: Readonly<string[]> = await getChangedCurrentFiles(relativeCopyFromDir);
    console.info(`"${changes.length}" changed files detected:\n    ${changes.join('\n    ')}`);

    console.info(`un-git-ignoring "${fleekDeployDir}"`);
    const wasRemoved = await removeMatchFromFile({fileName: '.gitignore', match: fleekDeployDir});

    if (wasRemoved) {
        console.info(`Successfully removed git-ignore for "${fleekDeployDir}"`);
    } else {
        console.info(
            `Failed to remove git-ignore for "${fleekDeployDir}". Maybe it wasn't git-ignored in the first place?`,
        );
    }

    console.info(`Committing everything...`);
    const newFullBuildCommitMessage = `${allBuildOutputCommitMessage} ${new Date().toISOString()}`;
    const newFullBuildCommitHash = await commitEverythingToCurrentBranch({
        commitMessage: newFullBuildCommitMessage,
        amend: true,
    });
    const withLatestBuildCommitHash = await getHeadCommitHash();
    console.info(`Committed all build outputs in "${newFullBuildCommitHash}" with message
    ${newFullBuildCommitMessage}`);

    const chunkedFiles: Readonly<string[][]> = divideArray(
        filesPerUpload,
        changes.map((changedFile) => join(process.cwd(), changedFile)),
    );
    console.info(`Changed files separated into "${chunkedFiles.length}" chunks.`);
    console.info(
        `Starting chunk copying with keep structure dir of "${buildOutputForCopyingFrom}"`,
    );

    await chunkedFiles.reduce(async (lastPromise, currentFiles, index) => {
        await lastPromise;
        const message = `adding built files from index "${index}" of "${
            chunkedFiles.length - 1
        }" with "${currentFiles.length}" total files.`;
        console.info(message);
        console.info(
            `Copying "${currentFiles.length}" files to Fleek deploy dir:\n  ${currentFiles.join(
                '\n  ',
            )}`,
        );
        await remove(fullFleekDeployDirPath);
        await ensureDir(fullFleekDeployDirPath);
        await copyFilesToDir({
            copyToDir: fullFleekDeployDirPath,
            files: currentFiles,
            keepStructureFromDir: buildOutputForCopyingFrom,
        });
        console.info(`Making commit...`);
        await commitEverythingToCurrentBranch({
            commitMessage: message,
        });
        console.info(`Pushing branch...`);
        await pushBranch({
            branchName: buildOutputBranchName,
            remoteName: gitRemoteName,
            force: true,
        });
        const deployStartTimeMs: number = Date.now();
        console.info(`Waiting for Fleek deploy to start...`);
        const deployDetected = await waitUntilFleekDeployStarted(deployStartTimeMs);
        console.info(`Fleek deploy detected, waiting for it to finish...`);
        await waitUntilAllDeploysAreFinished(deployDetected);
        const deployEndTimeMs: number = Date.now();
        const deployTotalTimeS: number = (deployEndTimeMs - deployStartTimeMs) / 1000;

        console.info(`Fleek deploy finished. Took "${deployTotalTimeS}" seconds.`);
    }, Promise.resolve());

    await hardResetCurrentBranchTo(triggerBranchName, {
        remote: true,
        remoteName: gitRemoteName,
    });
    await cherryPickCommit({commitHash: withLatestBuildCommitHash});
    await pushBranch({
        branchName: buildOutputBranchName,
        remoteName: gitRemoteName,
        force: true,
    });

    const totalEndTimeMs: number = Date.now();
    const totalElapsedTimeS: number = (totalEndTimeMs - totalStartTimeMs) / 1000;

    console.info(
        `All "${chunkedFiles.length}" deploys completed.\n"${changes.length}" files deployed.\nTook "${totalElapsedTimeS}" seconds`,
    );
}
