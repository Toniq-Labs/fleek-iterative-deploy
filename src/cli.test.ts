import {runShellCommand} from 'augment-vir/dist/node-only';
import {defaultInputs} from './cli';
import {gitIt} from './git/git-shared-imports-for-testing';
import {DeployIterativelyInputs} from './iterative-deploy';

describe(__filename, () => {
    function parseInputLogging(stdout: string): DeployIterativelyInputs {
        function extractEnding(line: string): string {
            const ending = line
                .replace(/\s+\w+:\s+['"]?/, '')
                .trim()
                .replace(/['"]?,?$/, '');
            if (!ending) {
                throw new Error(`Failed to extract ending from "${line}"`);
            }
            return ending;
        }

        const lines = stdout.trim().split('\n');

        let buildCommand: string = '';
        let buildOutputBranchName: string = '';
        let fleekDeployDir: string = '';
        let filesPerUpload: number = -1;

        lines.forEach((line) => {
            if (line.trim().startsWith('buildCommand')) {
                buildCommand = extractEnding(line);
            }
            if (line.trim().startsWith('buildOutputBranchName')) {
                buildOutputBranchName = extractEnding(line);
            }
            if (line.trim().startsWith('fleekDeployDir')) {
                fleekDeployDir = extractEnding(line);
            }
            if (line.trim().startsWith('filesPerUpload')) {
                filesPerUpload = Number(extractEnding(line));
            }
        });

        return {
            buildCommand,
            buildOutputBranchName,
            fleekDeployDir,
            filesPerUpload,
        };
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
});
