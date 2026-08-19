import { getBillingCompletenessIssues } from '@/lib/contracts/billing-completeness'

describe('billing completeness — cheque', () => {
  it('exige banco o referencia de cheque', () => {
    expect(getBillingCompletenessIssues({ paymentMethodType: 'CHECK' })).toEqual([
      'Falta banco, número de cheque o cuenta de referencia',
    ])
    expect(
      getBillingCompletenessIssues({
        paymentMethodType: 'CHECK',
        paymentAccountRef: 'CHQ-1042 Banco Pichincha',
      })
    ).toEqual([])
  })
})
