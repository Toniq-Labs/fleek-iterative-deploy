import {randomString} from 'augment-vir/dist/node-only';
import {existsSync} from 'fs';
import {ensureDir} from 'fs-extra';
import {stat, writeFile} from 'fs/promises';
import {join} from 'path';
import {directoryForFleekIterativeDeployFiles} from '../file-paths';

/** Returns the file path for the file created */
export async function createNewTestFile(
    subDirCount = 0,
    relativeTo = directoryForFleekIterativeDeployFiles,
): Promise<string> {
    const directory = await createNewTestDir(subDirCount, relativeTo);
    const testFilePath = join(directory, `test-file-${randomString(8)}`);
    expect(existsSync(testFilePath)).toBe(false);
    await writeFile(testFilePath, `This file is just for testing.\n${randomString(32)}`);
    expect(existsSync(testFilePath)).toBe(true);
    expect((await stat(testFilePath)).isFile()).toBe(true);

    return testFilePath;
}

export async function createNewTestDir(
    subDirCount = 1,
    relativeTo = directoryForFleekIterativeDeployFiles,
): Promise<string> {
    let directory = relativeTo;

    if (subDirCount < 0) {
        subDirCount = 0;
    }

    if (
        subDirCount >
        // arbitrary max that seems good
        999
    ) {
        throw new Error(`Trying to nest sub directories too deeply.`);
    }

    for (let count = 0; count < subDirCount; count++) {
        const newSubDir = `test-dir-${randomString(8)}`;
        directory = join(directory, newSubDir);
    }

    await ensureDir(directory);
    expect(existsSync(directory)).toBe(true);
    expect((await stat(directory)).isDirectory()).toBe(true);

    return directory;
}
