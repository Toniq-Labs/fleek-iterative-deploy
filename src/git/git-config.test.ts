import {randomString} from 'augment-vir/dist/node-only';
import {readGitConfigValues, setGitConfigValues, unsetGitConfigKeys} from './git-config';

function randomBranchName(): string {
    return `test-branch-${randomString()}`;
}

describe(readGitConfigValues.name, () => {
    it('should read something for user name', async () => {
        const usernameRead = await readGitConfigValues(['user.name'] as const);
        expect(usernameRead).toBeDefined();
        expect(usernameRead['user.name']).toBeTruthy();
    });

    it('should get back narrow typing with a const array input', async () => {
        const usernameReadWithConst = await readGitConfigValues(['user.name'] as const);
        expect(usernameReadWithConst).toBeDefined();
        expect(usernameReadWithConst['user.name']).toBeTruthy();
        // @ts-expect-error
        expect(usernameReadWithConst['something-else']).toBeFalsy();
    });

    it('should return nothing for keys that have not been set (without throwing an error)', async () => {
        const randomConfigKey = `branch.${randomBranchName()}.remote` as const;
        const configWithNoValues = await readGitConfigValues([randomConfigKey] as const);
        expect(configWithNoValues[randomConfigKey]).toBeFalsy();
    });

    it('should fail for invalid keys', async () => {
        const invalidKey = `this super duper is not a git key` as const;
        await expect(readGitConfigValues([invalidKey] as const)).rejects.toThrow(Error);
    });
});

describe(`${setGitConfigValues.name} and ${unsetGitConfigKeys.name}`, () => {
    it('should set a new config value', async () => {
        const beforeUsername: string = (await readGitConfigValues(['user.name'] as const))[
            'user.name'
        ];
        expect(beforeUsername).toBeTruthy();

        const newKey = `branch.${randomBranchName()}`;
        const newValue = `test-value-${randomString(16)}`;

        const beforeValue = (await readGitConfigValues([newKey]))[newKey];
        expect(beforeValue).toBeFalsy();

        await setGitConfigValues({[newKey]: newValue});

        // verify that other values were not changed
        const afterUsername: string = (await readGitConfigValues(['user.name'] as const))[
            'user.name'
        ];
        expect(afterUsername).toBe(beforeUsername);

        const afterValue = (await readGitConfigValues([newKey]))[newKey];
        expect(afterValue).toBe(newValue);

        await unsetGitConfigKeys([newKey]);

        // verify that other values were not changed
        const afterUnsetUsername = (await readGitConfigValues(['user.name'] as const))['user.name'];
        expect(afterUnsetUsername).toBe(beforeUsername);

        const afterUnsetValue = (await readGitConfigValues([newKey]))[newKey];
        expect(afterUnsetValue).toBeFalsy();
    });
});
