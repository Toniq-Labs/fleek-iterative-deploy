import {assertNotNullish} from 'augment-vir/dist/jest-only';
import {existsSync} from 'fs';
import {remove} from 'fs-extra';
import {unlink} from 'fs/promises';
import {relative} from 'path';
import {directoryForFleekIterativeDeployFiles} from '../file-paths';
import {createNewTestDir, createNewTestFile} from '../test/create-test-file';
import {copyFilesToDir} from './fs';

describe(copyFilesToDir.name, () => {
    it('should copy files over', async () => {
        const copyFromDir = await createNewTestDir();
        expect(copyFromDir).not.toBe(directoryForFleekIterativeDeployFiles);

        const copyToDir = await createNewTestDir();
        expect(copyToDir).not.toBe(directoryForFleekIterativeDeployFiles);

        const testFiles = await Promise.all(
            // prettier-multiline-arrays-next-line-pattern: 5
            [
                0, 0, 0, 0, 1,
                1, 2, 2, 2, 2,
                3, 3, 4, 4, 4,
            ].map(async (subDirCount) => {
                return createNewTestFile(subDirCount, copyFromDir);
            }),
        );

        testFiles.forEach((testFile) => {
            expect(existsSync(testFile)).toBe(true);
        });

        const newFilePaths = await copyFilesToDir({
            copyToDir,
            files: testFiles,
            keepStructureFromDir: copyFromDir,
        });

        await Promise.all(
            newFilePaths.map(async (newFilePath, index) => {
                const oldFilePath = testFiles[index];
                assertNotNullish(oldFilePath);
                expect(oldFilePath).not.toBe('');
                expect(newFilePath).not.toBe('');
                expect(existsSync(oldFilePath)).toBe(true);
                expect(existsSync(newFilePath)).toBe(true);

                expect(relative(copyFromDir, oldFilePath)).toBe(relative(copyToDir, newFilePath));

                await unlink(oldFilePath);
                await unlink(newFilePath);
                expect(existsSync(oldFilePath)).not.toBe(true);
                expect(existsSync(newFilePath)).not.toBe(true);
            }),
        );

        await remove(copyFromDir);
        await remove(copyToDir);
        expect(existsSync(copyFromDir)).not.toBe(true);
        expect(existsSync(copyToDir)).not.toBe(true);
    });
});
