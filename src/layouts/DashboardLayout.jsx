import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import { useData } from '../context/GlobalDataContext';

const DashboardLayout = () => {
  const { currentUser } = useData();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const role = currentUser?.role || 'staff';

  return (
    <div className="min-h-screen bg-background text-primary">
      {/* Global Print Watermark */}
      <div className="hidden print-watermark-container">
          <img src="/logo.png" alt="Watermark" />
      </div>

      <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} role={role} />

      <div className="transition-all duration-300 lg:pl-72 min-w-0 w-full box-border">
        <Topbar toggleSidebar={toggleSidebar} role={role} />

        <main className="w-full min-w-0 max-w-[1600px] mx-auto p-4 lg:p-8 animate-fade-in overflow-x-hidden box-border">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
