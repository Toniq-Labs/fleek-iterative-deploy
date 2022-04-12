import {runShellCommand} from 'augment-vir/dist/node-only';
import {safeInterpolate} from './shell';

describe(safeInterpolate.name, () => {
    it('should now allow breaking out of a command', async () => {
        const tryToBreakOutMessage = '"hello there"; echo "PANIC TIME";';
        const command = `echo ${safeInterpolate(tryToBreakOutMessage)}`;
        const commandOutput = await runShellCommand(command, {rejectOnError: true});

        expect(commandOutput.stdout.trim()).toBe(tryToBreakOutMessage);
    });

    it('should be able to detect breaking out without safe interpolation', async () => {
        const tryToBreakOutMessage = '"hello there"; echo "PANIC TIME";';
        const command = `echo ${tryToBreakOutMessage}`;
        const commandOutput = await runShellCommand(command, {rejectOnError: true});

        expect(commandOutput.stdout.trim()).toBe('hello there\nPANIC TIME');
    });

    it('should blocking breaking out with quotes', async () => {
        const tryToBreakOutMessage = '"hello there"; echo "PANIC TIME";\' echo "I have you now."';
        const command = `echo ${safeInterpolate(tryToBreakOutMessage)}`;
        const commandOutput = await runShellCommand(command, {rejectOnError: true});

        expect(commandOutput.stdout.trim()).toBe(tryToBreakOutMessage);
    });
});
