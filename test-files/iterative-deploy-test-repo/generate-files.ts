import {randomString} from 'augment-vir/dist/node-only';
import {existsSync} from 'fs';
import {ensureDir} from 'fs-extra';
import {writeFile} from 'fs/promises';
import {join} from 'path';

const deployFromHereDir = join(__dirname, 'deploy-from-here');

type GenerateRandomFilesInput = {
    fileCount: number;
    fileSizeBytes: number;
};

async function generateRandomFiles(inputs: GenerateRandomFilesInput) {
    await ensureDir(deployFromHereDir);

    await Promise.all(
        Array(inputs.fileCount)
            .fill(0)
            .map(async () => {
                const randomFileName = randomString(16);
                const randomFilePath = join(deployFromHereDir, randomFileName);
                const randomFileContents = randomString(inputs.fileSizeBytes);

                if (existsSync(randomFilePath)) {
                    throw new Error(
                        `File name "${randomFileName}" clashed with an already existing file: "${randomFilePath}"`,
                    );
                }

                await writeFile(randomFilePath, randomFileContents);
            }),
    );
}

if (require.main === module) {
    const fileCount = Number(process.argv[2]);
    const fileSizeBytes = Number(process.argv[3]);

    if (isNaN(fileCount)) {
        throw new Error(
            `Invalid input for fileCount (first argument): "${process.argv[2]}". Expected a number.`,
        );
    }
    if (isNaN(fileSizeBytes)) {
        throw new Error(
            `Invalid input for fileSizeBytes (second argument): "${process.argv[3]}". Expected a number.`,
        );
    }

    generateRandomFiles({fileCount, fileSizeBytes}).catch((error) => {
        console.error(error);
        process.exit(1);
    });
}
