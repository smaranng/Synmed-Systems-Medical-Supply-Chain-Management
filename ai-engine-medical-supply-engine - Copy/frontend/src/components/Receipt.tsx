import { useMemo, useRef } from 'react';
import { OrderPayload, StoredOrder } from '../api/api';

type InvoiceOrder = OrderPayload | StoredOrder;

interface ReceiptFeedback {
  message: string;
  tone: 'success' | 'error';
}

interface ReceiptProps {
  order: InvoiceOrder | null;
  pharmacyName: string;
  onClose: () => void;
  onConfirm?: () => void;
  confirming?: boolean;
  feedback?: ReceiptFeedback | null;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | undefined): string {
  const dateToFormat = value ?? new Date().toISOString();
  return new Date(dateToFormat).toLocaleString();
}

function createPrintableDocument(title: string, content: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body {
        margin: 0;
        padding: 24px;
        background: #ffffff;
        color: #0f172a;
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
      }
      .invoice-sheet {
        border: 1px solid #cbd5e1;
        padding: 24px;
      }
      .invoice-header {
        display: flex;
        justify-content: space-between;
        gap: 24px;
        margin-bottom: 24px;
      }
      .invoice-title {
        font-size: 28px;
        font-weight: 700;
        margin: 0 0 8px;
      }
      .invoice-subtitle {
        color: #475569;
        margin: 0;
        line-height: 1.5;
      }
      .meta-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
        margin-bottom: 24px;
      }
      .meta-box {
        border: 1px solid #cbd5e1;
        padding: 12px;
      }
      .meta-label {
        margin: 0;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #64748b;
      }
      .meta-value {
        margin: 8px 0 0;
        font-size: 15px;
        font-weight: 600;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 24px;
      }
      th, td {
        border: 1px solid #cbd5e1;
        padding: 10px 12px;
        text-align: left;
        font-size: 13px;
      }
      th {
        background: #f8fafc;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .align-right {
        text-align: right;
      }
      .summary-wrap {
        margin-left: auto;
        width: 100%;
        max-width: 360px;
      }
      .summary-table td:first-child {
        background: #f8fafc;
        font-weight: 600;
      }
      .summary-total td {
        font-weight: 700;
        font-size: 15px;
      }
      @media print {
        body {
          padding: 0;
        }
        .invoice-sheet {
          border: none;
          padding: 0;
        }
      }
    </style>
  </head>
  <body>
    ${content}
  </body>
</html>`;
}

function Receipt({
  order,
  pharmacyName,
  onClose,
  onConfirm,
  confirming = false,
  feedback = null,
}: ReceiptProps) {
  const invoiceRef = useRef<HTMLDivElement | null>(null);

  const totals = useMemo(() => {
    if (!order) {
      return {
        gross: 0,
        discount: 0,
        taxable: 0,
        gst: 0,
        cgst: 0,
        sgst: 0,
      };
    }

    return Object.values(order.items).reduce(
      (accumulator, item) => {
        accumulator.gross += item.taxBreakdown.gross;
        accumulator.discount += item.taxBreakdown.discount;
        accumulator.taxable += item.taxBreakdown.taxable;
        accumulator.gst += item.taxBreakdown.gst;
        accumulator.cgst += item.taxBreakdown.cgst;
        accumulator.sgst += item.taxBreakdown.sgst;
        return accumulator;
      },
      {
        gross: 0,
        discount: 0,
        taxable: 0,
        gst: 0,
        cgst: 0,
        sgst: 0,
      },
    );
  }, [order]);

  if (!order) {
    return null;
  }

  const invoiceHeading = onConfirm ? 'Order Invoice Preview' : 'Confirmed Order Invoice';
  const invoiceDate = 'created_at' in order ? order.created_at : undefined;
  const lineItems = Object.entries(order.items).map(([itemKey, item], index) => {
    const totalAmount = Number(
      (item.taxBreakdown.taxable + item.taxBreakdown.gst).toFixed(2),
    );

    return {
      key: itemKey,
      serialNumber: index + 1,
      ...item,
      discountAmount: item.taxBreakdown.discount,
      taxableAmount: item.taxBreakdown.taxable,
      gstAmount: item.taxBreakdown.gst,
      totalAmount,
    };
  });

  const handlePrint = () => {
    if (!invoiceRef.current) {
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) {
      return;
    }

    printWindow.document.open();
    printWindow.document.write(
      createPrintableDocument(
        `${order.orderid} Invoice`,
        invoiceRef.current.innerHTML,
      ),
    );
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const handleDownloadPdf = () => {
    handlePrint();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 px-4 py-6">
      <div className="mx-auto w-full max-w-7xl">
        <div className="rounded-lg border border-slate-300 bg-white text-slate-900 shadow-xl">
          <div className="border-b border-slate-200 px-6 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Procurement Invoice
                </p>
                <h2 className="mt-2 text-3xl font-semibold text-slate-900">
                  {invoiceHeading}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Traditional procurement invoice layout for review, print, and order execution.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
                >
                  Print Invoice
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
                >
                  Download PDF
                </button>
              </div>
            </div>
          </div>

          {feedback ? (
            <div
              className={`mx-6 mt-6 border px-4 py-3 text-sm ${
                feedback.tone === 'success'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : 'border-rose-300 bg-rose-50 text-rose-700'
              }`}
            >
              {feedback.message}
            </div>
          ) : null}

          <div className="p-6">
            <div ref={invoiceRef} className="invoice-sheet">
              <div className="invoice-header flex flex-col gap-6 border-b border-slate-200 pb-6 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="invoice-title text-3xl font-semibold text-slate-900">
                    {invoiceHeading}
                  </h3>
                  <p className="invoice-subtitle mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    Review the procurement invoice in ERP format before confirming or printing.
                  </p>
                </div>
              </div>

              <div className="meta-grid mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="meta-box border border-slate-300 p-4">
                  <p className="meta-label text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Order ID
                  </p>
                  <p className="meta-value mt-2 text-sm font-semibold text-slate-900">
                    {order.orderid}
                  </p>
                </div>
                <div className="meta-box border border-slate-300 p-4">
                  <p className="meta-label text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Pharmacy Name
                  </p>
                  <p className="meta-value mt-2 text-sm font-semibold text-slate-900">
                    {pharmacyName}
                  </p>
                </div>
                <div className="meta-box border border-slate-300 p-4">
                  <p className="meta-label text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Distributor ID
                  </p>
                  <p className="meta-value mt-2 text-sm font-semibold text-slate-900">
                    {order.distributorid}
                  </p>
                </div>
                <div className="meta-box border border-slate-300 p-4">
                  <p className="meta-label text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Date
                  </p>
                  <p className="meta-value mt-2 text-sm font-semibold text-slate-900">
                    {formatDate(invoiceDate)}
                  </p>
                </div>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                      <th className="border border-slate-300 px-3 py-3">Serial No</th>
                      <th className="border border-slate-300 px-3 py-3">Medicine Name</th>
                      <th className="border border-slate-300 px-3 py-3 text-right">Quantity</th>
                      <th className="border border-slate-300 px-3 py-3 text-right">Unit Price</th>
                      <th className="border border-slate-300 px-3 py-3 text-right">Discount %</th>
                      <th className="border border-slate-300 px-3 py-3 text-right">Discount Amount</th>
                      <th className="border border-slate-300 px-3 py-3 text-right">Taxable Amount</th>
                      <th className="border border-slate-300 px-3 py-3 text-right">GST %</th>
                      <th className="border border-slate-300 px-3 py-3 text-right">GST Amount</th>
                      <th className="border border-slate-300 px-3 py-3 text-right">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item) => (
                      <tr key={`${order.orderid}-${item.key}`} className="align-top text-sm">
                        <td className="border border-slate-300 px-3 py-3">{item.serialNumber}</td>
                        <td className="border border-slate-300 px-3 py-3">
                          <p className="font-semibold text-slate-900">{item.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            HSN {item.hsnCode} | Dist Ref {item.productID_Dtb} | Pharm Ref{' '}
                            {item.productID_Phm}
                          </p>
                        </td>
                        <td className="border border-slate-300 px-3 py-3 text-right">
                          {item.quantity}
                        </td>
                        <td className="border border-slate-300 px-3 py-3 text-right">
                          {formatCurrency(item.price)}
                        </td>
                        <td className="border border-slate-300 px-3 py-3 text-right">
                          {item.discountPercent.toFixed(2)}%
                        </td>
                        <td className="border border-slate-300 px-3 py-3 text-right">
                          {formatCurrency(item.discountAmount)}
                        </td>
                        <td className="border border-slate-300 px-3 py-3 text-right">
                          {formatCurrency(item.taxableAmount)}
                        </td>
                        <td className="border border-slate-300 px-3 py-3 text-right">
                          {item.gstRate.toFixed(2)}%
                        </td>
                        <td className="border border-slate-300 px-3 py-3 text-right">
                          {formatCurrency(item.gstAmount)}
                        </td>
                        <td className="border border-slate-300 px-3 py-3 text-right font-semibold">
                          {formatCurrency(item.totalAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="summary-wrap ml-auto mt-6 w-full max-w-md">
                <table className="summary-table w-full border-collapse">
                  <tbody>
                    <tr>
                      <td className="border border-slate-300 px-4 py-3 text-sm text-slate-700">
                        Gross Amount
                      </td>
                      <td className="border border-slate-300 px-4 py-3 text-right text-sm font-semibold">
                        {formatCurrency(totals.gross)}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 px-4 py-3 text-sm text-slate-700">
                        Total Discount
                      </td>
                      <td className="border border-slate-300 px-4 py-3 text-right text-sm font-semibold">
                        {formatCurrency(totals.discount)}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 px-4 py-3 text-sm text-slate-700">
                        Taxable Amount
                      </td>
                      <td className="border border-slate-300 px-4 py-3 text-right text-sm font-semibold">
                        {formatCurrency(totals.taxable)}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 px-4 py-3 text-sm text-slate-700">
                        CGST
                      </td>
                      <td className="border border-slate-300 px-4 py-3 text-right text-sm font-semibold">
                        {formatCurrency(totals.cgst)}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 px-4 py-3 text-sm text-slate-700">
                        SGST
                      </td>
                      <td className="border border-slate-300 px-4 py-3 text-right text-sm font-semibold">
                        {formatCurrency(totals.sgst)}
                      </td>
                    </tr>
                    <tr className="summary-total bg-slate-50">
                      <td className="border border-slate-300 px-4 py-3 text-sm text-slate-900">
                        Final Total Amount
                      </td>
                      <td className="border border-slate-300 px-4 py-3 text-right text-sm font-bold text-slate-900">
                        {formatCurrency(order.totalAmount)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 px-6 py-4">
            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={confirming}
                className="border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {onConfirm ? 'Cancel' : 'Close'}
              </button>
              {onConfirm ? (
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={confirming}
                  className="border border-slate-900 bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {confirming ? 'Confirming...' : 'Confirm Order'}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Receipt;
