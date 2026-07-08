import { useData } from '../../context/GlobalDataContext';
import StatusBadge from '../../components/StatusBadge';
import Table from '../../components/Table';
import { Truck, Ship, Plane, MapPin } from 'lucide-react';

const Logistics = () => {
  const { deliveries } = useData();

  const columns = [
    {
      header: "Transport",
      accessor: "mode",
      render: (row) => (
        <div className="flex items-center gap-2">
          {row.mode === 'Sea' ? <Ship size={16} /> : row.mode === 'Air' ? <Plane size={16} /> : <Truck size={16} />}
          <span>{row.mode || 'Road'}</span>
        </div>
      )
    },
    {
      header: "Item / Mission",
      accessor: "item",
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-bold">{row.item}</span>
          <span className="text-[10px] text-muted">{row.id}</span>
        </div>
      )
    },
    { header: "Driver/Operator", accessor: "driver", render: (row) => row.driver || row.assignedStaff || 'Unassigned' },
    { header: "Vehicle ID", accessor: "vehicle", render: (row) => row.vehicle || row.vesselOrFlight || 'TBD' },
    { header: "Location", accessor: "location" },
    { header: "ETA/Time", accessor: "eta", render: (row) => row.eta || row.time || 'TBD' },
    {
      header: "Status",
      accessor: "status",
      render: (row) => <StatusBadge status={row.status} />
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Elite Logistics</h1>
        <p className="text-secondary mt-1">Real-time transport tracking and dispatch management.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold">Active Deliveries</h3>
            <button className="btn-primary py-1.5 text-xs">Dispatch New</button>
          </div>
          <Table columns={columns} data={deliveries} actions={true} />
        </div>

        <div className="glass-card p-6 border-accent/20">
          <h3 className="text-lg font-bold mb-6">Live Dispatch Map</h3>
          <div className="aspect-square bg-white/5 rounded-xl border border-border relative overflow-hidden">
            {/* Mock Map View */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-muted text-xs uppercase tracking-widest font-bold">Map View [Simulated]</span>
            </div>

            <div className="absolute top-1/4 left-1/3">
              <div className="relative">
                <div className="absolute -inset-2 bg-accent/20 rounded-full animate-ping" />
                <div className="relative w-4 h-4 bg-accent rounded-full border-2 border-background" />
              </div>
            </div>

            <div className="absolute bottom-1/3 right-1/4">
              <div className="relative">
                <div className="absolute -inset-2 bg-info/20 rounded-full animate-ping" />
                <div className="relative w-4 h-4 bg-info rounded-full border-2 border-background" />
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="p-4 bg-white/5 rounded-xl border border-border">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-sm font-bold">TRK-402 (Robert Fox)</p>
                  <p className="text-xs text-secondary">Approaching Villa 4 Pier</p>
                </div>
                <div className="px-2 py-0.5 bg-accent/10 rounded text-[10px] text-accent font-bold">ON TRACK</div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted">
                <MapPin size={12} />
                <span>ETA: 15 mins • 4.2 km remaining</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Logistics;
