import { debugOnlyLog } from '../../../src/utils/utilities';  
  
describe('utilities', () => {  
  it('should not log to console when process.env.DEBUG is anything but TRUE', () => {
    process.env.DEBUG = 'NOT TRUE';
    jest.spyOn(console, 'log');
    debugOnlyLog('Do not log me!');

    expect(console.log).toHaveBeenCalledTimes(0);
  });
  
  it('should log to console when process.env.DEBUG is TRUE', () => {
    process.env.DEBUG = 'TRUE';
    jest.spyOn(console, 'log');
    debugOnlyLog('Log me!');

    expect(console.log).toHaveBeenCalledWith('Log me!');
  });
});
