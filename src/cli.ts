#!/usr/bin/env node

import {defaultInputs} from './cli-default-inputs';
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
    const fleekPublicDir: string = args[1] ?? defaultInputs.fleekPublicDir;
    const fleekDeployBranchName: string = args[2] ?? defaultInputs.fleekDeployBranchName;

    const deployInputs: DeployIterativelyInputs = {
        buildCommand,
        fleekDeployBranchName,
        fleekPublicDir,
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
        await deployIteratively(process.cwd(), deployInputs);
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error);
        process.exit(1);
    });
}
