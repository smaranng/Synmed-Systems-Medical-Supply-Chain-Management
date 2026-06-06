import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { orderService, StockHistoryEntry } from '../services/orderService';

interface StockActivityProps {
  pharmaID: string;
  refreshKey?: number;
}

export function StockActivity({ pharmaID, refreshKey = 0 }: StockActivityProps) {
  const [entries, setEntries] = useState<StockHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await orderService.getStockHistory(pharmaID, 20);
        if (!ignore) {
          setEntries(data);
        }
      } catch (err: any) {
        if (!ignore) {
          setError(err?.message || 'Failed to load stock activity');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    if (pharmaID) {
      load();
    }

    return () => {
      ignore = true;
    };
  }, [pharmaID, refreshKey]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stock Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {loading && <p className="text-sm text-gray-500">Loading stock activity...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {!loading && !error && entries.length === 0 && (
          <p className="text-sm text-gray-500">No stock activity yet.</p>
        )}

        {!loading && !error && entries.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-3">Product</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Quantity</th>
                  <th className="py-2 pr-3">Balance</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => {
                  const rowKey = entry._id || `${entry.productID}-${entry.createdAt || index}`;
                  const qtyUnits = Number(entry.quantity?.units || 0);
                  const qtySubUnits = Number(entry.quantity?.subUnits || 0);
                  const balUnits = Number(entry.balanceAfter?.unitsAvailable || 0);
                  const balSubUnits = Number(entry.balanceAfter?.subUnitsAvailable || 0);

                  return (
                    <tr key={rowKey} className="border-b">
                      <td className="py-2 pr-3">{entry.productID || '-'}</td>
                      <td className="py-2 pr-3">{entry.type || '-'}</td>
                      <td className="py-2 pr-3">
                        {qtyUnits}U + {qtySubUnits}SU
                      </td>
                      <td className="py-2 pr-3">
                        {balUnits}U + {balSubUnits}SU
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
