import {ensureDirSync} from 'fs-extra';
import {dirname, join} from 'path';

const fleekIterativeDeployRepoDir = dirname(__dirname);

export const keysDir = join(fleekIterativeDeployRepoDir, '.keys');

export const readmeForIterationBranchFile = join(
    fleekIterativeDeployRepoDir,
    'iteration-branch-readme.md',
);

const fleekIterativeDeployDirName = '.fleek-iterative-deploy';
export const fleekIterativeDeployRelativeDirPath = join(
    fleekIterativeDeployDirName,
    'build-output',
);

export const directoryForFleekIterativeDeployFiles = join(
    process.cwd(),
    fleekIterativeDeployDirName,
);

ensureDirSync(directoryForFleekIterativeDeployFiles);

// the following testing directories will not exit when published on npm
const testFilesDir = join(fleekIterativeDeployRepoDir, 'test-files');
export const specificallySizedFilesDir = join(testFilesDir, 'specifically-sized-files');

export const testIterativeDeployDir = join(testFilesDir, 'iterative-deploy-test-repo');
export const recursiveFileReadDir = join(testFilesDir, 'recursive-file-reading');
