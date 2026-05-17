import Navbar from './Navbar';
import Sidebar from './Sidebar';

export default function AppShell({ children }) {
  return (
    <div className="min-h-screen bg-[#060d1f] gs-grid-bg">
      <Navbar />
      <div className="flex pt-14">
        <Sidebar />
        <main className="flex-1 ml-56 min-h-[calc(100vh-3.5rem)] p-6 lg:p-8">
          <div className="max-w-7xl mx-auto gs-page-enter">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
