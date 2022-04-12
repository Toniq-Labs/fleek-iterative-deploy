import {getRefBaseName} from './git-shared-imports';

describe(getRefBaseName.name, () => {
    it('should trim a ref to the branch name', () => {
        expect(getRefBaseName('refs/heads/main')).toBe('main');
    });
});
