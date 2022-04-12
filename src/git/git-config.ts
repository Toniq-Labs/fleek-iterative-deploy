import {ArrayElement} from 'augment-vir';

type StringsToPropertyKeys<T extends string[]> = Record<ArrayElement<T>, string>;

export async function readGitConfigValues<T extends string[]>(
    keys: T,
    global: boolean,
): Promise<StringsToPropertyKeys<T>> {
    return {} as any;
}
