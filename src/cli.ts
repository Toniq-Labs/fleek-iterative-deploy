#!/usr/bin/env node

import {deployIteratively, DeployIterativelyInputs} from './iterative-deploy';

const dryRunTriggers = [
    '--dry-run',
    '--dryRun',
    '--test',
];

export const defaultInputs: Readonly<DeployIterativelyInputs> = {
    buildCommand: 'npm run build',
    buildOutputBranchName: 'FLEEK_ITERATIVE_DEPLOY',
    fleekDeployDir: 'build',
    filesPerUpload: 50,
    gitRemoteName: 'origin',
} as const;

async function main() {
    const cliArgs = process.argv.slice(2);

    const args = cliArgs.filter((arg) => {
        return !dryRunTriggers.includes(arg);
    });

    const dryRun = args.length !== cliArgs.length;

    const buildCommand: string = args[0] ?? defaultInputs.buildCommand;
    const buildOutputBranchName: string = args[1] ?? defaultInputs.buildOutputBranchName;
    const fleekDeployDir: string = args[2] ?? defaultInputs.fleekDeployDir;
    const rawFilesPerUpload: number = Number(args[3]);
    const gitRemoteName: string = args[4] ?? defaultInputs.gitRemoteName;
    const filesPerUpload =
        isNaN(rawFilesPerUpload) || rawFilesPerUpload < 1
            ? defaultInputs.filesPerUpload
            : rawFilesPerUpload;

    const deployInputs: DeployIterativelyInputs = {
        buildCommand,
        buildOutputBranchName,
        fleekDeployDir,
        filesPerUpload,
        gitRemoteName,
    };

    console.info({deployInputs});

    if (!dryRun) {
        await deployIteratively(deployInputs);
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error);
        process.exit(1);
    });
}
