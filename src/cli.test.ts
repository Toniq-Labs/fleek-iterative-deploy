import {Site} from '@fleekhq/fleek-cli/dist/services/api/models';
import {runShellCommand} from 'augment-vir/dist/node-only';
import {afterInputs, afterSiteList, beforeInputs, beforeSiteList, defaultInputs} from './cli';
import {getTeamSites} from './fleek';
import {DeployIterativelyInputs} from './iterative-deploy';
import {tryToSetEnvVariables} from './test/fleek-testing';
import {gitIt} from './test/git-shared-imports-for-testing';

describe(__filename, () => {
    function parseInputLogging(stdout: string): DeployIterativelyInputs {
        const scopedOutput = stdout
            .trim()
            .replaceAll('\n', ' ')
            .replace(new RegExp(`^.*${beforeInputs}`), '')
            .replace(new RegExp(`${afterInputs}.*$`), '')
            .trim();

        try {
            const loggedInputs = JSON.parse(scopedOutput);
            return loggedInputs;
        } catch (error) {
            console.error(`Erroneous input logging JSON input below ===================`);
            console.error(scopedOutput);
            console.error('============================================================');
            throw error;
        }
    }

    function parseSiteLogging(stdout: string): Site[] {
        const scopedOutput = stdout
            .trim()
            .replaceAll('\n', ' ')
            .replace(new RegExp(`^.*${beforeSiteList}`), '')
            .replace(new RegExp(`${afterSiteList}.*$`), '')
            .trim();

        try {
            const parsedSiteList = JSON.parse(scopedOutput);
            return parsedSiteList;
        } catch (error) {
            console.error(`Erroneous site list JSON input below =======================`);
            console.error(scopedOutput);
            console.error('============================================================');
            throw error;
        }
    }

    gitIt(
        'should set default inputs correctly',
        async () => {
            const testCommand = 'npm run "test:cli"';
            const commandOutput = await runShellCommand(testCommand);
            if (commandOutput.exitCode !== 0) {
                throw new Error(
                    `"${testCommand}" failed with exit code "${commandOutput.exitCode}": ${commandOutput.stderr}`,
                );
            }

            const inputs = parseInputLogging(commandOutput.stdout);

            expect(inputs).toEqual(defaultInputs);
        },
        // long timeout for GitHub Actions which is very slow
        20000,
    );

    gitIt(
        'should get site list',
        async () => {
            await tryToSetEnvVariables();
            const testCommand = 'npm run "test:sites"';
            const commandOutput = await runShellCommand(testCommand);
            if (commandOutput.exitCode !== 0) {
                throw new Error(
                    `"${testCommand}" failed with exit code "${commandOutput.exitCode}": ${commandOutput.stderr}`,
                );
            }

            const siteOutput = parseSiteLogging(commandOutput.stdout);

            expect(siteOutput).toBeDefined();
            expect(Array.isArray(siteOutput)).toBe(true);
            expect(siteOutput.length).toBeGreaterThan(0);

            const sites = await getTeamSites();

            expect(siteOutput).toEqual(sites);
        },
        // long timeout for GitHub Actions which is very slow
        20000,
    );
});
