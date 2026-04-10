import type React from "react";

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="tv-dashboard">
      {/* White header with centered logo */}
      <header className="dashboard-header">
        <img
          src="/white-logo-sidebyside-1024.png"
          alt="Slide"
          className="logo-image"
        />
      </header>

      {/* Blue accent bar with moving gradient */}
      <div className="accent-bar"></div>

      {/* Main content */}
      <main className="dashboard-content">{children}</main>
    </div>
  );
};

export default Layout;
