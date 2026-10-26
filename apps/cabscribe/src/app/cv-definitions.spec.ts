import { CV_DEFINITIONS } from './cv-definitions';

describe('CV function reference', () => {
  it('contains unique addresses in ascending order', () => {
    const addresses = CV_DEFINITIONS.map((definition) => definition.address);
    expect(new Set(addresses).size).toBe(addresses.length);
    expect(addresses).toEqual([...addresses].sort((a, b) => a - b));
  });

  it('maps common functions and every speed-table step to its source address', () => {
    expect(CV_DEFINITIONS.find(({ address }) => address === 1)?.label).toBe(
      'Short decoder address'
    );
    expect(CV_DEFINITIONS.find(({ address }) => address === 29)?.label).toBe(
      'Decoder configuration 1'
    );
    for (let step = 1; step <= 28; step++) {
      expect(
        CV_DEFINITIONS.find(({ address }) => address === 66 + step)?.label
      ).toBe(`Speed table: step ${step}`);
    }
  });

  it('omits reserved and unused addresses rather than offering them as functions', () => {
    for (const address of [20, 26, 47, 48, 59, 60, 62, 65, 96, 104]) {
      expect(CV_DEFINITIONS.some((definition) => definition.address === address)).toBe(false);
    }
  });
});
