import type { ContractIntel, StubFieldData } from '@testament/shared';

export function buildStubFieldData(contract: ContractIntel): StubFieldData {
  return {
    fieldId: 'FIELD-001',
    siteName: contract.siteName,
    incarnateName: contract.targetName,
  };
}
