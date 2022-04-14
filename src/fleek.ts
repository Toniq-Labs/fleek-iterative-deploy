import DIContainer from '@fleekhq/fleek-cli/dist/dependency-injection/container';
import {ApiService} from '@fleekhq/fleek-cli/dist/services/api/api.service';
import {Deploy, DeployStatus} from '@fleekhq/fleek-cli/dist/services/api/models';
import AuthenticationService from '@fleekhq/fleek-cli/dist/services/authentication/authentication.service';
import {EnvironmentService} from '@fleekhq/fleek-cli/dist/services/environment/environment.service';
import {wait} from 'augment-vir';
import {gql, GraphQLClient, RequestDocument} from 'graphql-request';
import {checkEnvVar, fleekApiEnvKey, fleekTeamIdEnvKey, readEnvVar} from './env';

const tenSecondsMs = 10000;
const oneMinuteMs = 60000;
const tenMinutesMs = 10 * oneMinuteMs;

export async function waitUntilFleekDeployStarted(thresholdTimestamp: number): Promise<string> {
    await wait(tenSecondsMs);

    if (Date.now() > thresholdTimestamp + tenMinutesMs) {
        throw new Error(`Waited 10 minutes but Fleek deploy has still not started.`);
    }

    const deploys = await getSiteDeploys(readEnvVar(fleekTeamIdEnvKey));
    const afterStartTimeDeploys = deploys.filter((deploy) => {
        const deployStartTime: number = Date.parse(deploy.startedAt);
        if (isNaN(deployStartTime)) {
            throw new Error(
                `startedAt time "${deploy.startedAt}" loaded from deploy with id"${deploy.id}" is not a valid date string.`,
            );
        }

        return deployStartTime >= thresholdTimestamp;
    });

    if (afterStartTimeDeploys.length) {
        const firstAfterStartDeploy = afterStartTimeDeploys[0];
        if (!firstAfterStartDeploy) {
            throw new Error(`First deploy started was not defined somehow.`);
        }
        return firstAfterStartDeploy.id;
    } else {
        await wait(oneMinuteMs);
        return waitUntilFleekDeployStarted(thresholdTimestamp);
    }
}

export async function waitUntilAllDeploysAreFinished(trackingDeployId: string): Promise<void> {
    await wait(tenSecondsMs);

    const deploys = await getSiteDeploys(readEnvVar(fleekTeamIdEnvKey));
    const pendingDeploys = deploys.filter((deploy) => {
        return deploy.status === DeployStatus.InProgress;
    });

    const trackingDeploy = deploys.find((deploy) => deploy.id === trackingDeployId);
    if (!trackingDeploy) {
        throw new Error(`Could not find previously detected deploy by id "${trackingDeployId}"`);
    }
    if (trackingDeploy.status === DeployStatus.Cancelled) {
        throw new Error(`Deploy "${trackingDeployId}" was cancelled.`);
    }
    if (trackingDeploy.status === DeployStatus.Failed) {
        throw new Error(`Deploy "${trackingDeployId}" failed.`);
    }

    if (pendingDeploys.length) {
        await wait(oneMinuteMs);
        return waitUntilAllDeploysAreFinished(trackingDeployId);
    } else {
        return;
    }
}

async function makeRequest(query: RequestDocument, variables: any) {
    checkEnvVar(fleekApiEnvKey);
    const teamId = readEnvVar(fleekTeamIdEnvKey);

    const apiUrl = await DIContainer.get(EnvironmentService).getCurrentApiUrl();
    const apiKey = await DIContainer.get(AuthenticationService).getTeamApiKey(teamId);
    const client = new GraphQLClient(apiUrl, {
        headers: {
            authorization: apiKey,
        },
    });
    return client.request(query, variables);
}

export async function getTeamSites() {
    checkEnvVar(fleekApiEnvKey);
    const fleekApiService = DIContainer.get(ApiService);
    const sites = await fleekApiService.getSitesByTeam(readEnvVar(fleekTeamIdEnvKey));
    return sites;
}

type FullDeploy = Deploy & {
    startedAt: string;
    completedAt: string | null;
    totalTime: number;
    autoPublish: boolean;
};

export async function getSiteDeploys(siteId: string): Promise<FullDeploy[]> {
    const query = gql`
        query getDeploysBySite($siteId: ID!) {
            getDeploysBySite(siteId: $siteId) {
                deploys {
                    ... on Deploy {
                        id
                        startedAt
                        completedAt
                        status
                        totalTime
                        published
                        autoPublish
                    }
                }
            }
        }
    `;

    const response = await makeRequest(query, {siteId, commit: ''});
    return response.getDeploysBySite.deploys;
}
