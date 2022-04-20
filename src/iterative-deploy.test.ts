import {existsSync} from 'fs';
import {remove} from 'fs-extra';
import {readdir} from 'fs/promises';
import {join} from 'path';
import {defaultInputs} from './cli-default-inputs';
import {fleekIterativeDeployRelativeDirPath, testIterativeDeployDir} from './file-paths';
import {checkoutBranch, getCurrentBranchName} from './git/git-branches';
import {DeployIterativelyInputs, setupForIterativeDeploy} from './iterative-deploy';

describe(setupForIterativeDeploy.name, () => {
    it('should setup everything for deploying iteratively', async () => {
        const beforeBranch = await getCurrentBranchName();

        try {
            const buildFileToRun = join(testIterativeDeployDir, 'generate-files.ts');
            const testDir = testIterativeDeployDir;

            const randomlyGeneratedFileCount = 10;
            const deployRelativeDirName = 'deploy-from-here';
            const fullDeployDirPath = join(testDir, deployRelativeDirName);

            const fullFleekIterativeDeployDirPath = join(
                testDir,
                fleekIterativeDeployRelativeDirPath,
            );

            if (existsSync(fullDeployDirPath)) {
                expect(await readdir(fullDeployDirPath)).toEqual([]);
            }
            if (existsSync(fullFleekIterativeDeployDirPath)) {
                expect(await readdir(fullFleekIterativeDeployDirPath)).toEqual([]);
            }

            const deployIterativelyInputs: DeployIterativelyInputs = {
                buildCommand: `ts-node ${buildFileToRun} ${randomlyGeneratedFileCount} 50`,
                fleekDeployBranchName: defaultInputs.fleekDeployBranchName,
                fleekPublicDir: deployRelativeDirName,
            };

            await setupForIterativeDeploy(testDir, deployIterativelyInputs);

            expect(await getCurrentBranchName()).toBe(defaultInputs.fleekDeployBranchName);
            expect(existsSync(fullDeployDirPath)).toBe(true);
            expect(await readdir(fullDeployDirPath)).toEqual([]);
            expect(existsSync(fullFleekIterativeDeployDirPath)).toBe(true);
            expect((await readdir(fullFleekIterativeDeployDirPath)).length).toBe(
                randomlyGeneratedFileCount,
            );

            await remove(fullFleekIterativeDeployDirPath);
            expect(existsSync(fullFleekIterativeDeployDirPath)).toBe(false);
        } catch (error) {
            throw error;
        } finally {
            await checkoutBranch(beforeBranch);
            expect(await getCurrentBranchName()).toBe(beforeBranch);
        }
    }, 60000);
});
