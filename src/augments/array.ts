export function divideArray<T>(innerLength: number, input: Readonly<T[]>): T[][] {
    if (input.length <= innerLength) {
        return [input as T[]];
    } else {
        const currentDivision: Readonly<T[]> = input.slice(0, innerLength);
        const followingDivisions: Readonly<T[]>[] = divideArray(
            innerLength,
            input.slice(innerLength),
        );

        return [
            currentDivision as T[],
            ...(followingDivisions as T[][]),
        ];
    }
}
