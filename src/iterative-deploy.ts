import {runShellCommand} from 'augment-vir/dist/node-only';
import {copy, remove} from 'fs-extra';
import {relative} from 'path';
import {divideArray} from './augments/array';
import {copyFilesToDir} from './augments/fs';
import {buildOutputForCopyingFrom, readmeForIterationBranchFile} from './file-paths';
import {waitUntilAllDeploysAreFinished, waitUntilFleekDeployStarted} from './fleek';
import {
    commitEverythingToCurrentBranch,
    definitelyCheckoutBranch,
    getChangesInDirectory,
    getCurrentBranchName,
    hardResetCurrentBranchTo,
    pushCurrentBranch,
} from './git';

export type DeployIterativelyInputs = {
    buildOutputBranchName: string;
    buildCommand: string;
    fleekDeployDir: string;
    filesPerUpload: number;
};

export async function deployIteratively({
    buildOutputBranchName,
    buildCommand,
    fleekDeployDir,
    filesPerUpload,
}: DeployIterativelyInputs) {
    const totalStartTimeMs: number = Date.now();

    const triggerBranchName = await getCurrentBranchName();

    await definitelyCheckoutBranch(buildOutputBranchName);
    await hardResetCurrentBranchTo(triggerBranchName);
    const buildCommandOutput = await runShellCommand(buildCommand, {
        stderrCallback: console.error,
        stdoutCallback: console.log,
    });
    await copy(readmeForIterationBranchFile, 'README.md');

    if (buildCommandOutput.exitCode !== 0) {
        throw new Error(`Build command failed with exit code ${buildCommandOutput.exitCode}`);
    }

    // clear out the directory we'll be copying from
    await remove(buildOutputForCopyingFrom);
    // put all the build output into the directory we'll copy from
    await copy(fleekDeployDir, buildOutputForCopyingFrom);

    const relativeCopyFromDir = relative(process.cwd(), buildOutputForCopyingFrom);

    const changedFiles: Readonly<string[]> = await getChangesInDirectory(relativeCopyFromDir);

    console.info(`Changed files detected:\n  ${changedFiles.join('\n  ')}`);

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
        await pushCurrentBranch();
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
    const totalElapsedTimeS: number = (totalStartTimeMs - totalEndTimeMs) / 1000;

    console.info(
        `All "${chunkedFiles.length}" deploys completed.\n"${changedFiles.length}" files deployed.\nTook "${totalElapsedTimeS}" seconds`,
    );
}
