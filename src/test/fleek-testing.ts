import {Site} from '@fleekhq/fleek-cli/dist/services/api/models';
import {readFile} from 'fs/promises';
import {join} from 'path';
import {fleekApiEnvKey, fleekSiteIdEnvKey, fleekTeamIdEnvKey} from '../env';
import {keysDir} from '../file-paths';
import {getTeamSites} from '../fleek';

const deployTestingKeyword = 'deploy-testing' as const;

export async function getDeployTestingSite(): Promise<Site> {
    const sites = await getTeamSites();
    const deployTestingSite = sites.find((site) => site.name.includes(deployTestingKeyword));

    if (!deployTestingSite) {
        throw new Error(
            `Could not find any fleek sites that included the string "${deployTestingKeyword}"`,
        );
    }
    return deployTestingSite;
}

export async function tryToSetEnvVariables() {
    const keys = [
        fleekApiEnvKey,
        fleekTeamIdEnvKey,
        fleekSiteIdEnvKey,
    ];

    await Promise.all(
        keys.map(async (key) => {
            try {
                const keyFileContents = (await readFile(join(keysDir, key.key))).toString();
                process.env[key.key] = keyFileContents.trim();
            } catch (error) {}
        }),
    );
}
