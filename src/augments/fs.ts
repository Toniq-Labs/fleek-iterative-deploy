import {isTruthy} from 'augment-vir/dist';
import {copy, ensureDir} from 'fs-extra';
import {readFile, stat, writeFile} from 'fs/promises';
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
                    throw new Error(`File is outside of keepStructureFromDir: "${filePath}"`);
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
export async function partitionFileArrayByCountAndFileSize(
    fileArray: string[],
    options: {
        maxFileChunksPerPartition: number;
        minFileChunkBytes: number;
    },
): Promise<string[][]> {
    const final2dArray: string[][] = [];
    let currentFilePartition: string[] = [];
    let currentFilePartitionChunkCount = 0;

    await fileArray.reduce(async (lastPromise, filePath) => {
        await lastPromise;
        const fileBytes = (await stat(filePath)).size;
        let fileChunkCount = Math.ceil(fileBytes / options.minFileChunkBytes);
        if (fileChunkCount < 1) {
            fileChunkCount = 1;
        }

        if (
            // if nothing is in the file array and we're already beyond the max... we just gotta do the best we can.
            currentFilePartitionChunkCount > 0 &&
            currentFilePartitionChunkCount + fileChunkCount > options.maxFileChunksPerPartition
        ) {
            final2dArray.push(currentFilePartition);
            currentFilePartition = [];
            currentFilePartitionChunkCount = 0;
        }

        currentFilePartitionChunkCount += fileChunkCount;
        currentFilePartition.push(filePath);
    }, Promise.resolve());

    if (currentFilePartition.length) {
        final2dArray.push(currentFilePartition);
    }

    return final2dArray;
}
