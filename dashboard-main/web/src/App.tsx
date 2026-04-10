import Dashboard from "./pages/dashboard";
import "./styles/global.css";
import "leaflet/dist/leaflet.css";

function App() {
  return (
    <div className="tv-dashboard">
      {/* White header with centered logo */}
      <header className="dashboard-header">
        <img
          src="/images/white-logo-sidebyside-1024.png"
          alt="Slide"
          className="logo-image"
        />
      </header>

      {/* Blue accent bar */}
      <div className="accent-bar"></div>

      {/* Main content */}
      <main className="dashboard-content">
        <Dashboard />
      </main>
    </div>
  );
}

export default App;
