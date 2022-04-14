# fleek-iterative-deploy

## Install

```bash
npm i -D fleek-iterative-deploy
```

## Setting variables

You can set an env variable with `export ENV_VAR_NAME=value_here;` before your commands.

Example:

```bash
export FLEEK_API_KEY=insertYourKeyHere; export FLEEK_TEAM_ID=insertYourTeamIdHere; npx fleek-iterative-deploy --sites
```

### Fleek api key: `FLEEK_API_KEY`

Your Fleek API key must be stored in the `FLEEK_API_KEY` env variable before running commands from this package. To get a Fleek API key, do the following:

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

## Run

### Get Fleek Site ids

I haven't found a good way to find Fleek site ids, so here's how to get a list. It'll simply log the list of sites given your env Fleek API key and team id variables.

```bash
npx fleek-iterative-deploy --sites
```

### Dry run

This will allow you to test inputs. All inputs will be set and logged but the iterative deploy won't get started.

```bash
npx fleek-iterative-deploy --dry-run
```

### Run iterative deploy with defaults

```bash
npx fleek-iterative-deploy
```

### Run with custom inputs

```bash
npx fleek-iterative-deploy "<build-bash-command>" "<iterative-branch-name>" "<fleek-deploy-dir>" "<files-per-deploy-iteration>" "<remote-name>"
```
