import {setGitConfigValues} from './git-config';

export async function setFleekIterativeDeployGitUser() {
    await setGitConfigValues({
        'user.name': 'fleek-iterative-deploy runner',
        'user.email': 'N/A',
    });
}
