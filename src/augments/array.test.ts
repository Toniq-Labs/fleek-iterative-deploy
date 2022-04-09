import {divideArray} from './array';

describe(divideArray.name, () => {
    const testArray: Readonly<string[]> =
        'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

    function divideByRandomAmount<T>(arrayToDivide: Readonly<T[]>) {
        if (!arrayToDivide.length) {
            throw new Error(`Cannot divide array with zero length.`);
        }

        const maxDivisionLength = Math.floor(arrayToDivide.length / 5);

        const divisionLength = Math.floor(Math.random() * maxDivisionLength) + 1;

        const divisions = divideArray(divisionLength, arrayToDivide);

        return {divisions, divisionLength};
    }

    it('should divide an array', () => {
        const {divisions, divisionLength} = divideByRandomAmount(testArray);
        const lastIndex = divisions.length - 1;

        const expectedDivisionCount = Math.ceil(testArray.length / divisionLength);
        expect(divisions.length).toBe(expectedDivisionCount);

        divisions.forEach((division, index) => {
            if (index < lastIndex) {
                expect(division.length).toBe(divisionLength);
            } else {
                expect(division.length).toBeLessThanOrEqual(divisionLength);
            }
        });
    });

    it('should not mutate the array', () => {
        const originalElements = [...testArray];

        divideArray(5, testArray);

        expect(testArray).toBe(testArray);
        expect(testArray).toEqual(originalElements);
        originalElements.forEach((originalElement, index) => {
            expect(testArray[index]).toBe(originalElement);
        });
    });

    it('should include all elements in same order', () => {
        const {divisions} = divideByRandomAmount(testArray);
        const flattenedDivisions = divisions.flat();

        expect(testArray).toEqual(flattenedDivisions);
    });
});
