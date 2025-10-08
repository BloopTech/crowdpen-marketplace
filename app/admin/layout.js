import React from "react";
import AdminHeader from "./components/header";
import AdminSidebar from "./components/sidebar";
import { AdminProvider } from "./context";

export default async function AdminDashboardLayout({ children }) {
  return (
    <div className="bg-[#f4f4f4] dark:bg-[#121212] dark:text-white text-black w-full">
      <div className="mx-auto max-w-screen-2xl">
        <AdminSidebar />
        <main className="lg:pl-62 flex flex-col w-full">
          <div className="flex flex-col min-h-screen">
            <div className="lg:px-10 px-5">
              <AdminHeader />
            </div>
            <main className="flex-grow lg:pt-[5rem] pt-[2rem]">
              <AdminProvider>
                {children}
              </AdminProvider>
            </main>
          </div>
        </main>
      </div>
    </div>
  );
}
