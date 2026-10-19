import assert from 'node:assert/strict';
import test from 'node:test';
import {paymentStatus,isSalesRecord,pickupLabel} from '../src/saleStatus.ts';
test('payment and pickup statuses vary independently',()=>{
  assert.equal(paymentStatus(1000,0),'Unpaid');
  assert.equal(paymentStatus(1000,400),'Partially paid');
  assert.equal(paymentStatus(1000,1000),'Fully paid');
  assert.equal(paymentStatus(1000,1100),'Fully paid');
  assert.equal(pickupLabel('Released'),'Taken / Released');
  assert.equal(pickupLabel('Finished'),'Finished (pickup unconfirmed)');
  assert.equal(isSalesRecord({status:'Partial',jobStatus:'Released'}),true);
  assert.equal(isSalesRecord({status:'Pending',jobStatus:'Released'}),true);
  assert.equal(isSalesRecord({status:'Pending',jobStatus:'APPROVED'}),false);
  assert.equal(isSalesRecord({status:'Cancelled',jobStatus:'Released'}),false);
});
