import {ArrayElement} from 'augment-vir';
import {runShellCommand} from 'augment-vir/dist/node-only';
import {safeInterpolate} from '../augments/shell';

type StringsToPropertyKeys<T extends Readonly<string[]>> = Record<ArrayElement<T>, string>;

export type SharedGitConfigOptions = {
    /**
     * When set to false or omitted (the default), local config values are used. Set to true to use
     * global config values.
     */
    global?: boolean;
};

export async function readGitConfigValues<T extends Readonly<string[]>>(
    /** Pass this as a const (as const) to get narrow type info on the return type. */
    keys: T,
    options?: SharedGitConfigOptions,
): Promise<StringsToPropertyKeys<T>> {
    const returnObject = {} as StringsToPropertyKeys<T>;
    await Promise.all(
        keys.map(async (key: keyof StringsToPropertyKeys<T>) => {
            const globalFlag = options?.global ? ' --global' : '';
            const readConfigCommand = `git config${globalFlag} ${safeInterpolate(key)}`;

            const gitResponse = await runShellCommand(readConfigCommand);

            if (gitResponse.stderr) {
                const globalInMessage = options?.global ? ' global' : '';
                throw new Error(
                    `Failed to read${globalInMessage} git config value for "${key}": ${gitResponse.stderr}`,
                );
            }

            const configValue = gitResponse.stdout.trim();
            returnObject[key] = configValue;
        }),
    );

    return returnObject;
}

export type SetGitConfigOptions = SharedGitConfigOptions & {
    /**
     * When set to false or omitted (the default), config keys will not be set if they already have
     * a previously stored value.
     */
    override?: boolean;
};

export async function setGitConfigValues<T extends Record<string, string>>(
    configValues: T,
    options?: SetGitConfigOptions,
): Promise<Record<keyof T, boolean>> {
    const returnObject = {} as Record<keyof T, boolean>;
    const configKeys: Readonly<string[]> = Object.keys(configValues);
    const currentValues = options?.override
        ? // when overriding the values, we don't care about reading them beforehand.
          {}
        : await readGitConfigValues(configKeys, options);

    await Promise.all(
        configKeys.map(async (key: keyof T) => {
            if (typeof key !== 'string') {
                throw new Error(`Invalid git config key of "${key}". All keys must be strings.`);
            }
            if (!options?.override) {
                const currentValue = currentValues[key];
                if (currentValue) {
                    returnObject[key as keyof T] = false;
                    return;
                }
            }

            const newValue = configValues[key];

            if (typeof newValue !== 'string') {
                const globalInMessage = options?.global ? ' global' : '';
                throw new Error(
                    `Cannot set git config${globalInMessage} value "${newValue}" (for key "${key}"). Value must be a string.`,
                );
            }

            const globalFlag = options?.global ? ' --global' : '';
            const setCommand = `git config${globalFlag} ${safeInterpolate(key)} ${safeInterpolate(
                newValue,
            )}`;

            const gitResponse = await runShellCommand(setCommand, {rejectOnError: true});

            return gitResponse.exitCode === 0;
        }),
    );

    return {} as any;
}

export async function unsetGitConfigKeys<T extends string[]>(
    keys: T,
    options?: SharedGitConfigOptions,
): Promise<void> {
    await Promise.all(
        keys.map(async (key: keyof StringsToPropertyKeys<T>) => {
            const globalFlag = options?.global ? ' --global' : '';
            const readConfigCommand = `git config${globalFlag} --unset ${safeInterpolate(key)}`;

            const gitResponse = await runShellCommand(readConfigCommand);

            if (gitResponse.stderr) {
                const globalInMessage = options?.global ? ' global' : '';
                throw new Error(
                    `Failed to unset${globalInMessage} git config for "${key}": ${gitResponse.stderr}`,
                );
            }
        }),
    );
}
