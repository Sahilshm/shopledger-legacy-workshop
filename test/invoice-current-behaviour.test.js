'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var tax = require('../lib/tax');

test('invoice figures match checkout GST slabs, tax, and total for the billed order', function () {
  var items = [
    { id: 1, name: 'Tea', hsn: '0902', price: 140, qty: 2 },
    { id: 2, name: 'Toor Dal', hsn: '0713', price: 165, qty: 2 }
  ];
  var charged = pricing.computeTotals(items, '');
  var figures = invoice.computeInvoiceFigures({ items: items, coupon: '', total: charged.total });

  assert.equal(figures.tax, charged.tax);
  assert.equal(figures.cgst, charged.cgst);
  assert.equal(figures.sgst, charged.sgst);
  assert.equal(figures.total, charged.total);
  assert.deepEqual(figures.rows.map(function (row) { return [row.gstPercent, row.lineTax]; }), [[18, 50.4], [5, 16.5]]);
});

test('CURRENT BEHAVIOUR: pricing uses HSN slab and reduces taxable value by the coupon before GST', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];

  var charged = pricing.computeTotals(items, 'WELCOME');

  assert.deepEqual({
    subtotal: charged.subtotal,
    discount: charged.discount,
    taxable: charged.taxable,
    tax: charged.tax,
    cgst: charged.cgst,
    sgst: charged.sgst,
    total: charged.total
  }, {
    subtotal: 100,
    discount: 5,
    taxable: 95,
    tax: 4.75,
    cgst: 2.38,
    sgst: 2.37,
    total: 99.75
  });
});

test('invoice uses the HSN slab and pre-tax coupon discount used for checkout', function () {
  var order = {
    id: 41,
    items: [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
    coupon: 'WELCOME',
    total: 99.75
  };

  var figures = invoice.computeInvoiceFigures(order);
  var html = invoice.render(order);

  assert.deepEqual({
    subtotal: figures.subtotal,
    discount: figures.discount,
    tax: figures.tax,
    cgst: figures.cgst,
    sgst: figures.sgst,
    total: figures.total,
    rowGstPercent: figures.rows[0].gstPercent
  }, {
    subtotal: 100,
    discount: 5,
    tax: 4.75,
    cgst: 2.38,
    sgst: 2.37,
    total: 99.75,
    rowGstPercent: 5
  });
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice resolves numeric gstRate the same way as checkout pricing', function () {
  var item = { name: 'Tea', hsn: '0902', gstRate: 0.05, price: 100, qty: 1 };

  assert.equal(tax.getRateForItem(item), 0.05);
  assert.equal(pricing.computeTotals([item], '').tax, 5);
  assert.equal(invoice.computeInvoiceFigures({ items: [item] }).tax, 5);
  assert.equal(invoice.computeInvoiceFigures({ items: [{ name: 'Tea', gstRate: 5, price: 100, qty: 1 }] }).tax, 5);
});

test('invoice reports tax after a flat coupon discount, matching checkout pricing', function () {
  var items = [{ id: 2, name: 'Ghee', hsn: '0405', price: 300, qty: 1 }];
  var charged = pricing.computeTotals(items, 'FLAT50');
  var figures = invoice.computeInvoiceFigures({ items: items, coupon: 'FLAT50', total: charged.total });

  assert.deepEqual({
    chargedDiscount: charged.discount,
    chargedTax: charged.tax,
    chargedTotal: charged.total,
    invoiceDiscount: figures.discount,
    invoiceTax: figures.tax,
    invoiceTotal: figures.total
  }, {
    chargedDiscount: 50,
    chargedTax: 30,
    chargedTotal: 280,
    invoiceDiscount: 50,
    invoiceTax: 30,
    invoiceTotal: 280
  });
});
