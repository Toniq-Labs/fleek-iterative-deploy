import {runShellCommand} from 'augment-vir/dist/node-only';
import {copy, ensureDir, remove} from 'fs-extra';
import {readdir} from 'fs/promises';
import {join, relative} from 'path';
import {
    copyFilesToDir,
    partitionFilesBySize,
    readDirPathsRecursive,
    removeMatchFromFile,
} from './augments/fs';
import {githubRef, readEnvVar} from './env';
import {fleekIterativeDeployRelativeDirPath, readmeForIterationBranchFile} from './file-paths';
import {waitUntilAllDeploysAreFinished, waitUntilFleekDeployStarted} from './fleek';
import {
    checkoutBranch,
    definitelyCheckoutBranch,
    getCurrentBranchName,
    hardResetCurrentBranchTo,
    pushBranch,
    updateAllFromRemote,
} from './git/git-branches';
import {getChangedCurrentFiles, getChanges} from './git/git-changes';
import {
    cherryPickCommit,
    commitEverythingToCurrentBranch,
    getCommitDifference,
    getCommitMessage,
    getHeadCommitHash,
    stageEverything,
} from './git/git-commits';
import {getRefBaseName} from './git/git-shared-imports';
import {setFleekIterativeDeployGitUser} from './git/set-fleek-iterative-deploy-git-user';

// 30 MB = 30 * 1024 * 1024 = 31,457,280
const totalByteSizePerDeploy = 31_457_280;
const gitRemoteName = 'origin';

export type DeployIterativelyInputs = {
    fleekDeployBranchName: string;
    buildCommand: string;
    fleekPublicDir: string;
};

const allBuildOutputCommitMessage = 'add all build output';
const noBuildTrigger = /nobuild!|!nobuild/;
const forceDeployTrigger = /forcefleekdeploy!|!forcefleekdeploy/;

export async function setupForIterativeDeploy(
    cwd: string,
    {fleekDeployBranchName, buildCommand, fleekPublicDir}: DeployIterativelyInputs,
): Promise<Readonly<{chunkedFiles: Readonly<string[][]>; totalChanges: number}>> {
    // get and verify branch name
    const triggerBranchName =
        getRefBaseName(readEnvVar(githubRef)) || (await getCurrentBranchName());

    if (!triggerBranchName) {
        throw new Error(`Failed to get trigger branch name`);
    }
    console.info({triggerBranchName});
    if (fleekDeployBranchName === triggerBranchName) {
        throw new Error(
            `Trigger branch name cannot be the same as fleekDeployBranchName: "${fleekDeployBranchName}"`,
        );
    }

    const fullFleekDeployDirPath = join(cwd, fleekPublicDir);

    await setFleekIterativeDeployGitUser();

    try {
        await updateAllFromRemote();
    } catch (error) {
        console.error(error);
        console.info(`\nFailed to update from remote. Proceeding anyway\n`);
    }

    if ((await getCurrentBranchName()) !== triggerBranchName) {
        console.info(`Checking out triggerBranchName: "${triggerBranchName}"`);
        await checkoutBranch(triggerBranchName);
    }

    const triggerBranchHeadHash = await getHeadCommitHash();
    const triggerBranchHeadMessage = await getCommitMessage(triggerBranchHeadHash);
    console.info(
        `on commit:\n    ${triggerBranchHeadHash}\nwith message:\n    ${triggerBranchHeadMessage}`,
    );

    const skipChangesCheck: boolean = !!triggerBranchHeadMessage
        .toLocaleLowerCase()
        .match(forceDeployTrigger);
    if (triggerBranchHeadMessage.toLowerCase().match(noBuildTrigger)) {
        throw new Error(
            `Aborting build due to "${noBuildTrigger}" match in HEAD commit message: "${triggerBranchHeadMessage}"`,
        );
    }

    // this removes stuff like yarn.lock getting updated after a workflow's npm install step
    const preStartChanges = await getChanges();

    if (preStartChanges.length) {
        console.info(
            `Changes detected (from npm install maybe?):\n    ${preStartChanges
                .map((change) => change.fullLine)
                .join('\n    ')}`,
        );
        console.info(`hard resetting branch...`);
        await hardResetCurrentBranchTo(triggerBranchName, {
            remote: true,
            remoteName: gitRemoteName,
        });
        const newCommitHash = await getHeadCommitHash();
        console.info(`Now on "${newCommitHash}"`);
        if (triggerBranchHeadHash !== newCommitHash) {
            console.info({triggerBranchHeadHash, newCommitHash});
            throw new Error(`HEAD hash changed after resetting to the same branch we were on.`);
        }
    }

    console.info(`Checking out fleekDeployBranchName: "${fleekDeployBranchName}"`);
    await definitelyCheckoutBranch({
        branchName: fleekDeployBranchName,
        allowFromRemote: true,
        remoteName: gitRemoteName,
    });
    const buildOutputBranchHeadHash = await getHeadCommitHash();
    const buildOutputBranchHeadMessage = await getCommitMessage(buildOutputBranchHeadHash);
    console.info(
        `Now on branch:\n    ${await getCurrentBranchName()}\ncommit:\n    "${buildOutputBranchHeadHash}"\nmessage:\n    "${buildOutputBranchHeadMessage}"`,
    );

    const previousBuildCommits = await getCommitDifference({
        notOnThisBranch: triggerBranchName,
        onThisBranch: fleekDeployBranchName,
    });
    console.info(`previous build commits:\n    ${previousBuildCommits.join('\n    ')}`);

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
        local: true,
    });
    const afterDeployBranchResetCommitHash = await getHeadCommitHash();
    console.info(
        `Now on "${afterDeployBranchResetCommitHash}", "${await getCommitMessage(
            afterDeployBranchResetCommitHash,
        )}"`,
    );

    await lastFullBuildCommits
        // reverse so we apply the commits in the order they were originally applied
        .reverse()
        // use reduce here so that commits don't run in parallel
        .reduce(async (lastPromise, buildCommit, index) => {
            await lastPromise;
            console.info(
                `cherry-picking build commit:\n    ${buildCommit.hash}\nwith commit message:\n    ${buildCommit.message}`,
            );
            const cherryPickExtraOptions =
                index === 0
                    ? {}
                    : {
                          stageOnly: true,
                      };

            // full cherry pick the first full build commit
            await cherryPickCommit({
                ...cherryPickExtraOptions,
                commitHash: buildCommit.hash,
                acceptAllCherryPickChanges: true,
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

    const buildOutputForCopyingFrom = join(cwd, fleekIterativeDeployRelativeDirPath);

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
    const filesToMove: Readonly<string[]> = skipChangesCheck
        ? await readDirPathsRecursive(relativeCopyFromDir)
        : await getChangedCurrentFiles(relativeCopyFromDir);
    console.info(
        `"${filesToMove.length}" changed files detected:\n    ${filesToMove.join('\n    ')}`,
    );

    if (!skipChangesCheck && filesToMove.length === 0) {
        console.info(`No changed files to deploy were detected!`);
        await pushBranch({
            branchName: fleekDeployBranchName,
            remoteName: gitRemoteName,
            force: true,
        });
        return {
            chunkedFiles: [],
            totalChanges: 0,
        };
    }

    console.info(`un-git-ignoring "${fleekPublicDir}"`);
    const wasRemoved = await removeMatchFromFile({
        fileName: '.gitignore',
        match: fleekPublicDir,
    });

    if (wasRemoved) {
        console.info(`Successfully removed git-ignore for "${fleekPublicDir}"`);
    } else {
        console.info(
            `Failed to remove git-ignore for "${fleekPublicDir}". Maybe it wasn't git-ignored in the first place? (It's okay if it wasn't.)`,
        );
    }

    console.info(`Committing everything...`);
    const newFullBuildCommitMessage = `${allBuildOutputCommitMessage} ${new Date().toISOString()}`;
    const newFullBuildCommitHash = await commitEverythingToCurrentBranch({
        commitMessage: newFullBuildCommitMessage,
        amend: true,
    });
    console.info(
        `Committed all build outputs in "${newFullBuildCommitHash}" with message\n    ${newFullBuildCommitMessage}`,
    );

    console.info('Chunking changed files...');

    const chunkedFiles: Readonly<string[][]> = await partitionFilesBySize(
        filesToMove.map((changedFile) => join(process.cwd(), changedFile)),
        totalByteSizePerDeploy,
    );
    console.info(`Changed files separated into "${chunkedFiles.length}" chunks.`);

    return {
        chunkedFiles,
        totalChanges: filesToMove.length,
    };
}

export async function deployIteratively(cwd: string, inputs: DeployIterativelyInputs) {
    const totalStartTimeMs: number = Date.now();

    const buildOutputForCopyingFrom = join(cwd, fleekIterativeDeployRelativeDirPath);
    const fullFleekDeployDirPath = join(cwd, inputs.fleekPublicDir);

    const {chunkedFiles, totalChanges} = await setupForIterativeDeploy(cwd, inputs);

    console.info(
        `Starting chunk copying with keep structure dir of "${buildOutputForCopyingFrom}"`,
    );
    await chunkedFiles.reduce(async (lastPromise, currentFiles, index) => {
        await lastPromise;
        const message = `adding built files from index "${index}" of "${
            chunkedFiles.length - 1
        }" with "${currentFiles.length}" files ("${totalChanges}" total files).`;
        console.info(message);
        console.info(
            `Copying "${currentFiles.length}" files to Fleek deploy dir:\n    ${currentFiles.join(
                '\n    ',
            )}`,
        );
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
            branchName: inputs.fleekDeployBranchName,
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

    const totalEndTimeMs: number = Date.now();
    const totalElapsedTimeS: number = (totalEndTimeMs - totalStartTimeMs) / 1000;

    console.info(
        `All "${chunkedFiles.length}" deploys completed.\n"${totalChanges}" files deployed.\nTook "${totalElapsedTimeS}" seconds`,
    );
}
