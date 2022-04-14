import {ensureDirSync} from 'fs-extra';
import {dirname, join} from 'path';

const fleekIterativeDeployRepoDir = dirname(__dirname);

export const keysDir = join(fleekIterativeDeployRepoDir, '.keys');

export const readmeForIterationBranchFile = join(
    fleekIterativeDeployRepoDir,
    'iteration-branch-readme.md',
);

export const directoryForFleekIterativeDeployFiles = join(process.cwd(), '.fleek-iterative-deploy');

export const buildOutputForCopyingFrom = join(
    directoryForFleekIterativeDeployFiles,
    'build-output',
);

ensureDirSync(directoryForFleekIterativeDeployFiles);
