import React, { useState } from 'react';
import { useDepartmentOrders } from '../hooks/api/useOrders';
import OrderTimeline from './OrderTimeline';
import Table from './Table';
import { RefreshCcw, History, ClipboardList, CheckCircle } from 'lucide-react';
import { isoDateSlice, displayOrderStatus } from '../utils/orderWorkflow';

const DepartmentWorkflowSection = ({ departmentKey, departmentLabel }) => {
  const [activeTab, setActiveTab] = useState('current'); // 'current' | 'processed'
  const [timelineOrder, setTimelineOrder] = useState(null);

  // Fetch Current Work
  const { 
    data: currentData, 
    isLoading: loadingCurrent, 
    refetch: refetchCurrent 
  } = useDepartmentOrders(departmentKey, null);

  // Fetch Processed Orders
  const { 
    data: processedData, 
    isLoading: loadingProcessed, 
    refetch: refetchProcessed 
  } = useDepartmentOrders(null, departmentKey);

  const currentOrders = currentData?.data?.orders || currentData?.orders || [];
  const processedOrders = processedData?.data?.orders || processedData?.orders || [];

  const handleRefresh = () => {
    refetchCurrent();
    refetchProcessed();
  };

  const columns = [
    { header: "Order ID", accessor: "id" },
    {
      header: "Client",
      accessor: "client",
      render: (row) => row.client?.companyName || row.client?.name || row.customer_name || "—"
    },
    {
      header: "Items",
      accessor: "items",
      render: (row) => {
        let itms = row.items && row.items.length > 0 ? row.items : (row.customItems || []);
        if (!itms || itms.length === 0) return "No Items";
        const firstItemName = itms[0]?.item?.name || itms[0]?.name || "Unknown Item";
        if (itms.length === 1) return firstItemName;
        return `${firstItemName} (+${itms.length - 1} more)`;
      }
    },
    {
      header: "Total Value",
      accessor: "totalAmount",
      render: (row) => {
        const total = row.totalAmount || row.total_amount || 0;
        return <span className="font-black text-accent">${parseFloat(total).toLocaleString()}</span>;
      }
    },
    {
      header: "Status",
      accessor: "status",
      render: (row) => (
        <span className="text-xs font-semibold capitalize">{displayOrderStatus(row.status)}</span>
      )
    },
    { 
      header: "Last Update", 
      accessor: "updatedAt", 
      render: (row) => isoDateSlice(row.updatedAt || row.created_at || row.createdAt) || '-' 
    }
  ];

  const dataToShow = activeTab === 'current' ? currentOrders : processedOrders;
  const isLoading = activeTab === 'current' ? loadingCurrent : loadingProcessed;

  return (
    <div className="glass-card p-6 border-accent/5 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
            <ClipboardList className="text-accent" size={20} />
            {departmentLabel} Workflow Tracker
          </h3>
          <p className="text-[10px] text-muted uppercase tracking-wider">
            Monitor active task handovers and process logs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-white/5 border border-white/10 rounded-xl p-0.5">
            <button
              onClick={() => setActiveTab('current')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                activeTab === 'current'
                  ? 'bg-accent text-white shadow-lg shadow-accent/20'
                  : 'text-white/40 hover:text-white'
              }`}
            >
              🟡 Current Work ({currentOrders.length})
            </button>
            <button
              onClick={() => setActiveTab('processed')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                activeTab === 'processed'
                  ? 'bg-accent text-white shadow-lg shadow-accent/20'
                  : 'text-white/40 hover:text-white'
              }`}
            >
              Check Processed ({processedOrders.length})
            </button>
          </div>

          <button
            onClick={handleRefresh}
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all"
            title="Refresh order lists"
          >
            <RefreshCcw size={14} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <RefreshCcw className="animate-spin text-accent" />
        </div>
      ) : (
        <Table
          columns={columns}
          data={dataToShow}
          actions={true}
          customAction={(item) => (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setTimelineOrder({ id: item.id, orderNumber: item.orderNumber });
              }}
              className="p-1.5 px-3 rounded-lg text-secondary hover:text-accent hover:bg-accent/10 transition-all flex items-center justify-center font-bold text-[10px] gap-1 border border-white/5"
              title="View order timeline"
            >
              <History size={13} /> Timeline
            </button>
          )}
        />
      )}

      <OrderTimeline
        isOpen={!!timelineOrder}
        onClose={() => setTimelineOrder(null)}
        orderId={timelineOrder?.id}
        orderNumber={timelineOrder?.orderNumber}
      />
    </div>
  );
};

export default DepartmentWorkflowSection;
