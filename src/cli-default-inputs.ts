import {DeployIterativelyInputs} from './iterative-deploy';

export const defaultInputs: Readonly<DeployIterativelyInputs> = {
    filesPerUpload: 200,
    buildCommand: 'npm run build',
    fleekPublicDir: 'build',
    fleekDeployBranchName: 'FLEEK_ITERATIVE_DEPLOY',
    gitRemoteName: 'origin',
} as const;
