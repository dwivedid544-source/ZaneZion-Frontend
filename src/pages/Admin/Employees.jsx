import React, { useState } from 'react';
import { Users, Shield, ExternalLink, Plus, RefreshCcw } from 'lucide-react';
import { useEmployees } from '../../hooks/api/useAdminCore';
import Table from '../../components/Table';
import Pagination from '../../components/Common/Pagination';

const Employees = () => {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const { data, isLoading, error } = useEmployees(page, 10, search);

    const employees = data?.data || [];
    const meta = data?.meta || { totalPages: 1, totalItems: 0 };

    const columns = [
        { header: "EMP ID", accessor: "employeeCode", render: (row) => <span className="font-mono text-xs">{row.employeeCode}</span> },
        { header: "Name", accessor: "firstName", render: (row) => <span className="font-bold">{row.firstName} {row.lastName}</span> },
        { header: "Department", accessor: "department", render: (row) => row.department?.name || 'N/A' },
        { header: "Designation", accessor: "designation", render: (row) => row.designation?.name || 'N/A' },
        { 
            header: "Status", 
            accessor: "status",
            render: (row) => (
                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${row.status === 'active' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}`}>
                    {row.status || 'Active'}
                </span>
            )
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-white italic uppercase flex items-center gap-2">
                        <Users className="text-accent" /> Employees
                    </h1>
                    <p className="text-secondary text-[10px] font-black uppercase tracking-[0.2em] mt-1">
                        Manage Organization Personnel
                    </p>
                </div>
            </div>

            <div className="glass-card p-6 border-white/5">
                {isLoading ? (
                    <div className="flex justify-center p-12"><RefreshCcw className="animate-spin text-accent" /></div>
                ) : error ? (
                    <div className="text-danger p-4">Failed to load employees.</div>
                ) : (
                    <>
                        <Table columns={columns} data={employees} />
                        <div className="mt-6 border-t border-white/5 pt-6">
                            <Pagination
                                currentPage={page}
                                totalPages={meta.totalPages}
                                onPageChange={setPage}
                                totalItems={meta.totalItems}
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default Employees;
