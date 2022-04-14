import {runShellCommand} from 'augment-vir/dist/node-only';
import {copy, remove} from 'fs-extra';
import {relative} from 'path';
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
import {getChangesInDirectory} from './git/git-changes';
import {
    cherryPickCommit,
    commitEverythingToCurrentBranch,
    getCommitDifference,
    getCommitMessage,
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

    await setFleekIterativeDeployGitUser();

    await updateAllFromRemote();

    await checkoutBranch(triggerBranch);

    const triggerBranchName = await getCurrentBranchName();
    console.info({triggerBranchName});

    if (!triggerBranch) {
        throw new Error(`No trigger branch name.`);
    }

    await definitelyCheckoutBranch({
        branchName: buildOutputBranchName,
        allowFromRemote: true,
        remoteName: gitRemoteName,
    });
    const previousBuildCommits = await getCommitDifference({
        notOnThisBranch: triggerBranchName,
        onThisBranch: buildOutputBranchName,
    });
    const previousBuildCommitsWithMessages = await Promise.all(
        previousBuildCommits.map(async (commitHash) => {
            return {
                message: await getCommitMessage(commitHash),
                hash: commitHash,
            };
        }),
    );
    const lastFullBuildCommit = previousBuildCommitsWithMessages.find((commitWithMessage) => {
        return commitWithMessage.message === allBuildOutputCommitMessage;
    });
    await hardResetCurrentBranchTo(triggerBranchName, {
        remote: true,
        remoteName: gitRemoteName,
    });
    if (lastFullBuildCommit) {
        console.log(`Last full build commit detected: ${lastFullBuildCommit}`);
        await cherryPickCommit(lastFullBuildCommit.hash);
    }
    const buildCommandOutput = await runShellCommand(buildCommand, {
        stderrCallback: console.error,
        stdoutCallback: console.log,
    });

    if (buildCommandOutput.exitCode !== 0) {
        throw new Error(`Build command failed with exit code ${buildCommandOutput.exitCode}`);
    }
    await copy(readmeForIterationBranchFile, 'README.md');

    // clear out the directory we'll be copying from
    await remove(buildOutputForCopyingFrom);
    // put all the build output into the directory we'll copy from
    await copy(fleekDeployDir, buildOutputForCopyingFrom);
    await remove(fleekDeployDir);

    const relativeCopyFromDir = relative(process.cwd(), buildOutputForCopyingFrom);

    const changedFiles: Readonly<string[]> = await getChangesInDirectory(relativeCopyFromDir);

    console.info(`Changed files detected:\n  ${changedFiles.join('\n  ')}`);

    await removeMatchFromFile({fileName: '.gitignore', match: fleekDeployDir});

    const newFullBuildCommitHash = await commitEverythingToCurrentBranch(
        allBuildOutputCommitMessage,
    );
    console.log(`Committed built outputs in "${newFullBuildCommitHash}"`);

    const chunkedFiles: Readonly<string[][]> = divideArray(filesPerUpload, changedFiles);

    await chunkedFiles.reduce(async (lastPromise, currentFiles, index) => {
        await lastPromise;
        console.info(
            `Copying "${currentFiles.length}" files to Fleek deploy dir:\n  ${currentFiles.join(
                '\n  ',
            )}`,
        );
        await remove(fleekDeployDir);
        await copyFilesToDir({
            copyToDir: fleekDeployDir,
            files: currentFiles,
            keepStructureFromDir: buildOutputForCopyingFrom,
        });
        console.info(`Making commit...`);
        await commitEverythingToCurrentBranch(
            `adding built files from index "${index}" with "${currentFiles.length}" total files.`,
        );
        console.info(`Pushing branch...`);
        await pushBranch({
            branchName: buildOutputBranchName,
            remoteName: gitRemoteName,
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
    await cherryPickCommit(newFullBuildCommitHash);
    await pushBranch({
        branchName: buildOutputBranchName,
        remoteName: gitRemoteName,
    });

    const totalEndTimeMs: number = Date.now();
    const totalElapsedTimeS: number = (totalStartTimeMs - totalEndTimeMs) / 1000;

    console.info(
        `All "${chunkedFiles.length}" deploys completed.\n"${changedFiles.length}" files deployed.\nTook "${totalElapsedTimeS}" seconds`,
    );
}
