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
