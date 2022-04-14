import {existsSync} from 'fs';
import {remove} from 'fs-extra';
import {readdir, unlink} from 'fs/promises';
import {dirname, relative} from 'path';
import {directoryForFleekIterativeDeployFiles} from '../file-paths';
import {createNewTestFile} from '../test/create-test-file';
import {
    expectChangesToInclude,
    expectNoChanges,
    gitIt,
} from '../test/git-shared-imports-for-testing';
import {getChanges, getChangesInDirectory} from './git-changes';
import {stageEverything} from './git-commits';

describe(getChanges, () => {
    gitIt('should show changes', async () => {
        await expectNoChanges();

        const testFilePath = await createNewTestFile();
        const afterCreationChanges = await getChanges();
        expect(afterCreationChanges.length).toBe(1);
        await expectChangesToInclude(testFilePath);

        await unlink(testFilePath);
        expect(existsSync(testFilePath)).toBe(false);

        await expectNoChanges();
    });
});

describe(getChangesInDirectory.name, () => {
    gitIt('should only return changes for the given directory', async () => {
        function getPathJustBeforeDeployFilesDir(input: string): string {
            const dir = dirname(input);
            if (dir === '/' || dir === '.' || !dir) {
                throw new Error(
                    `Could not find parent dir right before deploy files dir for "${input}"`,
                );
            }
            if (dir === directoryForFleekIterativeDeployFiles) {
                return input;
            } else {
                return getPathJustBeforeDeployFilesDir(dir);
            }
        }

        // make sure we're clean before running the test
        await expectNoChanges();

        const beforeContentsCount = (await readdir(directoryForFleekIterativeDeployFiles)).length;

        // just for the `.gitkeep` file
        expect(beforeContentsCount).toBe(1);

        const testFiles: string[] = await Promise.all(
            [
                2,
                3,
                5,
            ].map(async (subDirCount) => {
                return await createNewTestFile(subDirCount);
            }),
        );

        const afterCreationContentsCount = (await readdir(directoryForFleekIterativeDeployFiles))
            .length;

        expect(afterCreationContentsCount).toBe(beforeContentsCount + testFiles.length);
        // stage everything before checking changes so we get the full file path for each change

        await stageEverything();

        await expectChangesToInclude(testFiles);

        await Promise.all(
            testFiles.map(async (testFilePath) => {
                const testFileDirectory = dirname(testFilePath);
                expect(testFileDirectory).not.toBe(directoryForFleekIterativeDeployFiles);

                const relativeDir = relative(process.cwd(), testFileDirectory);
                const dirChanges = await getChangesInDirectory(relativeDir);
                if (dirChanges.length !== 1) {
                    console.error({testFilePath, relativeDir, changes: await getChanges()});
                }
                expect(dirChanges.length).toBe(1);
            }),
        );

        await Promise.all(
            testFiles.map(async (testFilePath) => {
                expect(existsSync(testFilePath)).toBe(true);
                const deployFilesSubDir = getPathJustBeforeDeployFilesDir(testFilePath);
                expect(existsSync(deployFilesSubDir)).toBe(true);
                await remove(deployFilesSubDir);
                expect(existsSync(deployFilesSubDir)).toBe(false);
            }),
        );

        // stage all the file deletions so we cancel out the previous additions
        await stageEverything();

        const afterDeletionContentsCount = (await readdir(directoryForFleekIterativeDeployFiles))
            .length;

        expect(afterDeletionContentsCount).toBe(beforeContentsCount);
    });
});
