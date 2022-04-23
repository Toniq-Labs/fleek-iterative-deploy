# fleek-iterative-deploy

Package that will iteratively deploy a site to [Fleek](https://fleek.co) by gradually committing all changed files to the deploy directory in a dedicated deploy branch.

Requires Node.js 16.

_Bonus points_: you won't use up your Fleek computation minutes because GitHub (or whatever system you run this package with) will be running your build command!

# What this solves

Fleek will easily fail to deploy to the IC if your site has too many files. Typically this is worked-around by manually deploying files iteratively. This script does it automatically and seamlessly!

# How this works

This package creates and manages a branch in your repo which Fleek will deploy from. It iteratively adds files from your build to that branch and waits for the subsequently triggered Fleek deploy to finish, then adds more files.

# Usage steps

## 1. Install

```bash
npm i -D fleek-iterative-deploy
```

## 2. Set environment variables

Use GitHub repo secrets to add env variables for GitHub Actions.

1. Go to your repository
2. Click on `Settings`
3. Click on `Secrets`, then `Actions`
4. Click the `New repository secret` button
5. Use the key and values as explained in the following sections.

You can also set an env variable with `export ENV_VAR_NAME=value_here;` before your commands when running commands directly in bash, like the following:

```bash
export FLEEK_API_KEY=insertYourKeyHere; export FLEEK_TEAM_ID=insertYourTeamIdHere; npx fleek-iterative-deploy --sites
```

### Fleek api key: `FLEEK_API_KEY`

Your Fleek API key must be stored in the `FLEEK_API_KEY` env variable before running commands from this package. To get your Fleek API key, do the following:

1. Go to the [Fleek app](https://app.fleek.co)
2. Login
3. Click on your user name in the ver bottom left corner
4. Click `Settings`
5. Click `Generate API` under the `Hosting API` section.
6. Copy that value and save it into the env variable `FLEEK_API_KEY` before running any commands from this package.

### Fleek team id: `FLEEK_TEAM_ID`

Your team id must be saved into the `FLEEK_TEAM_ID` env variable. To find this do the following:

1. Go to the [Fleek app](https://app.fleek.co)
2. Login
3. Look at the URL
4. Copy the id that's after `accountID=` in the URL.
5. Save this into the `FLEEK_TEAM_ID` env variable before running commands from this package.

### Fleek site id: `FLEEK_SITE_ID`

The id of the Fleek site you want to operate on must be set in the `FLEEK_SITE_ID` env variable. Finding your site's id is a little trickier, in my experience. Luckily, if you have the previous two env variables set already, you can use this package to find your site ids! To find your side id, do the following:

1. Make sure you've set the previous two env variables for your team id and API key.
2. run `npx fleek-iterative-deploy --sites`
3. Inspect the stdout output of the command. Find the site with the name you want, then copy its `id`.
4. Save this id into the `FLEEK_SITE_ID` env variable before running the full iterative deploy command from this package.

## 3. Set your Fleek deploy branch to `FLEEK_ITERATIVE_DEPLOY`

The `FLEEK_ITERATIVE_DEPLOY` branch will be created by this package. You can customize this branch name if you wish. See `fleek-deploy-dir` in the **Run with custom inputs** section at the bottom of this page.

## 4. Clear your build command from Fleek

**Make sure that your Fleek deploy settings _do not have_ a build command.** `npx fleek-iterative-deploy` will run the build command for you!

## 5. Create a GitHub Actions workflow

Add a GitHub Actions workflow that triggers when you push to `main` (or `master` or whatever branch you wish). See an example here: https://github.com/electrovir/test-iterative-fleek-deploy/blob/main/.github/workflows/test-fleek-iterative-deploy.yml

Most importantly your workflow must:

1. run on push
2. set env variables so that this package can access them (see the example above on how to do that, it's the part under `env:`).
3. run `npx fleek-iterative-deploy`

## 6. Customize inputs

If needed, customize your inputs to `npx fleek-iterative-deploy`. See the **Run with custom inputs** section at the bottom of the page for defaults.

## 7. Push!

With everything setup in your GitHub action, simply push to your `main` branch and the GitHub Action should run and deploy everything iteratively!

# Command details

## Get Fleek Site ids

I haven't found a good way to find Fleek site ids, so here's how to get a list. It'll simply log the list of sites given your env Fleek API key and team id variables.

```bash
export FLEEK_API_KEY=insertYourKeyHere; export FLEEK_TEAM_ID=insertYourTeamIdHere; npx fleek-iterative-deploy --sites
```

## Dry run

This allows you to test inputs. All inputs will be set and logged but the iterative deploy won't run.

```bash
npx fleek-iterative-deploy --dry-run
```

## Run iterative deploy with defaults

The full deploy with default inputs:

```bash
npx fleek-iterative-deploy
```

## Run with custom inputs

```bash
npx fleek-iterative-deploy "<buildCommand>" "<fleekPublicDir>" "<fleekDeployBranchName>"
```

-   **`buildCommand`**: this is the bash command which `fleek-iterative-deploy` will run to build your website.
-   **`fleekPublicDir`**: this is the directory which Fleek is configured to deploy files from; the `publicDir` property in a Fleek config file.
-   **`fleekDeployBranchName`**: this is the branch which Fleek will deploy from. This should _not_ be the same as the branch that triggers your GitHub Action.

The defaults are listed in the following object:

<!-- example-link: src/cli-default-inputs.ts -->

```TypeScript
import {DeployIterativelyInputs} from './iterative-deploy';

export const defaultInputs: Readonly<DeployIterativelyInputs> = {
    buildCommand: 'npm run build',
    fleekPublicDir: 'build',
    fleekDeployBranchName: 'FLEEK_ITERATIVE_DEPLOY',
} as const;
```

## Skipping deploy

To skip a deploy, add `nobuild!` or `!nobuild` to your latest commit message before pushing to your branch. This will abort the deploy before it starts.

## Forcing a deploy

To force a deploy, add `forcefleekdeploy!` or `!forcefleekdeploy` to your latest commit message before pushing. This will skip checking if any changes have been made since the last deploy, and just try to deploy everything.

# Example

The following currently use this package to deploy to the IC via Fleek.

-   https://github.com/electrovir/test-iterative-fleek-deploy
