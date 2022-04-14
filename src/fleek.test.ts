import {getSiteDeploys, getTeamSites} from './fleek';
import {getDeployTestingSite, tryToSetEnvVariables} from './test/fleek-testing';

describe(getSiteDeploys.name, () => {
    it('should get some deploys', async () => {
        await tryToSetEnvVariables();
        const deploys = await getSiteDeploys((await getDeployTestingSite()).id);
        expect(deploys).toBeDefined();
        expect(deploys.length).toBeGreaterThan(0);
    }, 60000);
});

describe(getTeamSites.name, () => {
    it('should get some sites', async () => {
        await tryToSetEnvVariables();
        const sites = await getTeamSites();
        expect(sites).toBeDefined();
        expect(sites.length).toBeGreaterThan(0);
    }, 60000);
});
