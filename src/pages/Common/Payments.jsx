import React, { useState } from 'react';
import Table from '../../components/Table';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api/setupAxios';
import { DollarSign, Search, FileText, Printer } from 'lucide-react';
import Pagination from '../../components/Common/Pagination';
import StatusBadge from '../../components/StatusBadge';

const Payments = () => {
    const [page, setPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');

    const { data: paymentsData, isLoading, error } = useQuery({
        queryKey: ['payments', page, 10, searchTerm],
        queryFn: async () => {
            const response = await api.get('/payments', {
                params: { page, limit: 10, search: searchTerm }
            });
            return response.data;
        }
    });

    const payments = paymentsData?.data?.payments || [];
    const totalItems = paymentsData?.data?.total || 0;
    const totalPages = paymentsData?.data?.totalPages || 1;

    const columns = [
        { header: "Payment ID", accessor: "id" },
        { header: "Invoice ID", accessor: "invoiceId" },
        { 
            header: "Amount", 
            accessor: "amount",
            render: (row) => <span className="font-bold text-success">${parseFloat(row.amount).toLocaleString()}</span>
        },
        { header: "Method", accessor: "paymentMethod" },
        { header: "Reference", accessor: "referenceNumber" },
        { header: "Date", accessor: "paymentDate", render: (row) => new Date(row.paymentDate).toLocaleDateString() }
    ];

    const handlePrintReceipt = async (payment) => {
        try {
            const res = await api.get(`/payments/receipts/${payment.id}`);
            const receipt = res.data.data;
            // Simulated print protocol
            console.log("Printing receipt...", receipt);
            alert(`Receipt ${receipt.receiptNumber} Printed!`);
            window.print();
        } catch (error) {
            alert("Could not load receipt.");
        }
    };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-white">Payments & Receipts</h1>
                <p className="text-secondary mt-1">View institutional payment records and generate receipts.</p>
            </div>

            <div className="glass-card p-6 border-white/5">
                <div className="flex mb-6">
                    <div className="relative max-w-sm w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
                        <input
                            type="text"
                            placeholder="Search by Payment ID, Invoice ID..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setPage(1);
                            }}
                            className="w-full bg-background border border-border rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-accent font-bold"
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex justify-center p-12 text-accent">Loading Payments...</div>
                ) : error ? (
                    <div className="text-danger p-4">Failed to load payments.</div>
                ) : (
                    <>
                        <Table
                            columns={columns}
                            data={payments}
                            actions={true}
                            customAction={(payment) => (
                                <button
                                    onClick={() => handlePrintReceipt(payment)}
                                    className="p-2 rounded-lg text-secondary hover:text-white hover:bg-white/10 transition-all flex items-center justify-center"
                                    title="Print Receipt"
                                >
                                    <Printer size={16} />
                                </button>
                            )}
                        />
                        {totalItems > 10 && (
                            <div className="mt-6 border-t border-white/5 pt-6">
                                <Pagination
                                    currentPage={page}
                                    totalPages={totalPages}
                                    onPageChange={setPage}
                                    totalItems={totalItems}
                                />
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default Payments;
