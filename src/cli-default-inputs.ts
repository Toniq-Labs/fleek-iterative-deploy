import {DeployIterativelyInputs} from './iterative-deploy';

export const defaultInputs: Readonly<DeployIterativelyInputs> = {
    buildCommand: 'npm run build',
    fleekPublicDir: 'build',
    fleekDeployBranchName: 'FLEEK_ITERATIVE_DEPLOY',
} as const;
