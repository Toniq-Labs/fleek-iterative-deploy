import {DeployIterativelyInputs} from './iterative-deploy';

export const defaultInputs: Readonly<DeployIterativelyInputs> = {
    buildCommand: 'npm run build',
    fleekPublicDir: 'build',
    filesPerUpload: 100,
    fleekDeployBranchName: 'FLEEK_ITERATIVE_DEPLOY',
    gitRemoteName: 'origin',
} as const;
