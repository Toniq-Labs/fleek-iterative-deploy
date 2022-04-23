import {isTruthy} from 'augment-vir/dist';
import {copy, ensureDir} from 'fs-extra';
import {readdir, readFile, stat, writeFile} from 'fs/promises';
import {basename, dirname, join, relative} from 'path';

export async function copyFilesToDir({
    keepStructureFromDir,
    copyToDir,
    files,
}: {
    keepStructureFromDir: string;
    copyToDir: string;
    files: string[];
}): Promise<string[]> {
    keepStructureFromDir = relative(process.cwd(), keepStructureFromDir);

    return (
        await Promise.all(
            files.map(async (filePath): Promise<string | undefined> => {
                const relativeToStructureDir = relative(keepStructureFromDir, filePath);

                if (relativeToStructureDir.startsWith('..')) {
                    throw new Error(
                        `File is outside of keepStructureFromDir ("${keepStructureFromDir}"): "${filePath}"`,
                    );
                }

                if (
                    (await stat(join(keepStructureFromDir, relativeToStructureDir))).isDirectory()
                ) {
                    return;
                }

                const newFilePath = join(
                    copyToDir,
                    dirname(relativeToStructureDir),
                    basename(filePath),
                );
                const newFileDir = dirname(newFilePath);

                if (newFileDir !== relativeToStructureDir) {
                    await ensureDir(newFileDir);
                }

                await copy(filePath, newFilePath);
                return newFilePath;
            }),
        )
    ).filter(isTruthy);
}

export type RemoveMatchFromFileInputs = {
    fileName: string;
    match: string | RegExp;
};

/** Returns true if modifications were made to the file */
export async function removeMatchFromFile(inputs: RemoveMatchFromFileInputs): Promise<boolean> {
    const currentFileContents = (await readFile(inputs.fileName)).toString();
    const replacedFileContents = currentFileContents.replace(inputs.match, '');
    if (currentFileContents.length !== replacedFileContents.length) {
        await writeFile(inputs.fileName, replacedFileContents);
        return true;
    } else {
        return false;
    }
}

/**
 * A file is considered a single "chunk" if it's size is equal to or less than (<=) the given
 * minFileChunkSize. If a file is larger than minFileChunkSize, it takes up multiple chunks. The
 * chunk limit for each partition of files is determined by maxFileChunksPerPartition.
 */
export async function partitionFilesBySize(
    fileArray: string[],
    maxPartitionSize: number,
): Promise<string[][]> {
    const final2dArray: string[][] = [];
    let currentFilePartition: string[] = [];
    let currentPartitionSize = 0;

    await fileArray.reduce(async (lastPromise, filePath) => {
        await lastPromise;
        const fileSizeBytes = (await stat(filePath)).size;

        if (
            // if nothing is in the file array and we're already beyond the max... we just gotta do the best we can.
            currentPartitionSize > 0 &&
            currentPartitionSize + fileSizeBytes > maxPartitionSize
        ) {
            final2dArray.push(currentFilePartition);
            currentFilePartition = [];
            currentPartitionSize = 0;
        }

        currentPartitionSize += fileSizeBytes;
        currentFilePartition.push(filePath);
    }, Promise.resolve());

    if (currentFilePartition.length) {
        final2dArray.push(currentFilePartition);
    }

    return final2dArray;
}

async function internalReadDirPathsRecursive(dirPath: string, basePath: string): Promise<string[]> {
    const dirContents = await readdir(dirPath);
    const recursiveContents: string[] = (
        await Promise.all(
            dirContents.map(async (fileName): Promise<string | string[]> => {
                const filePath = join(dirPath, fileName);
                if ((await stat(filePath)).isDirectory()) {
                    return internalReadDirPathsRecursive(filePath, basePath);
                } else {
                    return relative(basePath, filePath);
                }
            }),
        )
    ).flat();

    return recursiveContents;
}

/** Gets all files within a directory and its subdirectories, recursively. */
export async function readDirPathsRecursive(dirPath: string): Promise<string[]> {
    return await internalReadDirPathsRecursive(dirPath, dirPath);
}
