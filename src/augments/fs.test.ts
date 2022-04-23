import {assertNotNullish} from 'augment-vir/dist/jest-only';
import {existsSync} from 'fs';
import {remove} from 'fs-extra';
import {readdir, readFile, unlink, writeFile} from 'fs/promises';
import {join, relative} from 'path';
import {
    directoryForFleekIterativeDeployFiles,
    recursiveFileReadDir,
    specificallySizedFilesDir,
} from '../file-paths';
import {createNewTestDir, createNewTestFile} from '../test/create-test-file';
import {
    copyFilesToDir,
    partitionFilesBySize,
    readDirPathsRecursive,
    removeMatchFromFile,
} from './fs';

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

describe(removeMatchFromFile.name, () => {
    it('should delete a line', async () => {
        function createMessage(insertion: string) {
            return `stuff here\nand here${insertion}\nthe end`;
        }
        const testFile = await createNewTestFile();
        const matchingLine = '\nand more here';
        const startMessage = createMessage(matchingLine);
        await writeFile(testFile, startMessage);

        const afterFirstWrite = (await readFile(testFile)).toString();
        expect(afterFirstWrite).toBe(startMessage);

        const didRemove = await removeMatchFromFile({fileName: testFile, match: matchingLine});
        expect(didRemove).toBe(true);

        const afterRemoval = (await readFile(testFile)).toString();
        expect(afterRemoval).not.toBe(startMessage);
        expect(afterRemoval).toBe(createMessage(''));

        await remove(testFile);
        expect(existsSync(testFile)).toBe(false);
    });
});

describe(partitionFilesBySize.name, () => {
    it('should chunk files that are too big', async () => {
        const specificallySizedFiles = (await readdir(specificallySizedFilesDir))
            .sort((a, b) => {
                const aSizeText = a.replace(/^size-/, '').replace('.txt', '');
                const bSizeText = b.replace(/^size-/, '').replace('.txt', '');
                const aSize = Number(aSizeText);
                const bSize = Number(bSizeText);

                if (isNaN(aSize) || isNaN(bSize)) {
                    throw new Error(
                        `Invalid sizes extracted from files "${a}" or "${b}": "${aSizeText}" and "${bSizeText}"`,
                    );
                }
                return aSize - bSize;
            })
            .map((fileName) => join(specificallySizedFilesDir, fileName));
        expect(specificallySizedFiles.length).toBe(6);
        specificallySizedFiles.forEach((filePath) => {
            expect(existsSync(filePath)).toBe(true);
        });

        const chunkedBySize = await partitionFilesBySize(specificallySizedFiles, 120);

        const expectArray: string[][] = [
            [
                'size-0.txt',
                'size-4.txt',
                'size-16.txt',
                'size-32.txt',
            ],
            [
                'size-128.txt',
            ],
            [
                'size-1024.txt',
            ],
        ].map((row) => row.map((fileName) => join(specificallySizedFilesDir, fileName)));

        expect(chunkedBySize).toEqual(expectArray);
    });
});

describe(readDirPathsRecursive.name, () => {
    it('should read files in a directory recursively', async () => {
        const allFiles = (await readDirPathsRecursive(recursiveFileReadDir)).sort();
        expect(allFiles).toEqual([
            'a-file.txt',
            'b-file.txt',
            join('inner-dir', 'a-file.txt'),
            join('inner-dir', 'b-file.txt'),
            join('inner-dir', 'double-inner-dir', 'a-file.txt'),
            join('inner-dir', 'double-inner-dir', 'b-file.txt'),
        ]);
    });
});
