import { CvApplicabilityRules } from 'common';
import { CV_DEFINITIONS } from './cv-definitions';

// CV 29 bit 5 selects the two-byte (long) address; CVs 17/18 are only used then.
const LONG_ADDRESS_BIT = 0b100000;
const LONG_ADDRESS_REASON =
  'Not used: CV 29 selects the short address (bit 5 is clear).';

export const CV_APPLICABILITY_RULES: CvApplicabilityRules = new Map(
  [17, 18].map((cv) => [
    cv,
    {
      dependsOn: 29,
      isApplicable: (controllingValue: number) =>
        (controllingValue & LONG_ADDRESS_BIT) !== 0,
      reason: LONG_ADDRESS_REASON,
    },
  ])
);

export function describeCv(address: number): string {
  return CV_DEFINITIONS.find((definition) => definition.address === address)?.label ?? '';
}
