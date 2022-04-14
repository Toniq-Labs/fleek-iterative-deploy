#!/usr/bin/env node

import {getTeamSites} from './fleek';
import {deployIteratively, DeployIterativelyInputs} from './iterative-deploy';

const dryRunTriggers = [
    '--dry-run',
    '--dryrun',
    '--test',
];

const getSitesTriggers = ['--sites'];

export const beforeSiteList = 'Logging site list below';
export const afterSiteList = 'Done logging site list';

export const beforeInputs = 'Logging inputs below';
export const afterInputs = 'Done logging inputs';

export const defaultInputs: Readonly<DeployIterativelyInputs> = {
    buildCommand: 'npm run build',
    buildOutputBranchName: 'FLEEK_ITERATIVE_DEPLOY',
    fleekDeployDir: 'build',
    triggerBranch: 'main',
    filesPerUpload: 50,
    gitRemoteName: 'origin',
} as const;

async function main() {
    const cliArgs = process.argv.slice(2);
    let dryRun = false;
    let justGetSites = false;

    const args = cliArgs.filter((arg) => {
        if (dryRunTriggers.includes(arg.toLowerCase())) {
            dryRun = true;
            return false;
        }
        if (getSitesTriggers.includes(arg.toLowerCase())) {
            justGetSites = true;
            return false;
        }
        return true;
    });

    const buildCommand: string = args[0] ?? defaultInputs.buildCommand;
    const buildOutputBranchName: string = args[1] ?? defaultInputs.buildOutputBranchName;
    const triggerBranch: string = args[2] ?? defaultInputs.triggerBranch;
    const fleekDeployDir: string = args[3] ?? defaultInputs.fleekDeployDir;
    const rawFilesPerUpload: number = Number(args[4]);
    const gitRemoteName: string = args[5] ?? defaultInputs.gitRemoteName;
    const filesPerUpload =
        isNaN(rawFilesPerUpload) || rawFilesPerUpload < 1
            ? defaultInputs.filesPerUpload
            : rawFilesPerUpload;

    const deployInputs: DeployIterativelyInputs = {
        buildCommand,
        triggerBranch,
        buildOutputBranchName,
        fleekDeployDir,
        filesPerUpload,
        gitRemoteName,
    };

    console.info(beforeInputs);
    console.info(JSON.stringify(deployInputs, null, 4));
    console.info(afterInputs);

    if (dryRun) {
        // do nothing
    } else if (justGetSites) {
        const sites = await getTeamSites();
        console.info(beforeSiteList);
        console.info(JSON.stringify(sites, null, 4));
        console.info(afterSiteList);
    } else {
        await deployIteratively(deployInputs);
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error);
        process.exit(1);
    });
}
