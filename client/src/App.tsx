import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import KubectlTerminal from './components/KubectlTerminal';
import NodesView from './components/NodesView';
import PodsView from './components/PodsView';
import DeploymentsView from './components/DeploymentsView';
import ServicesView from './components/ServicesView';
import ClustersView from './components/ClustersView';

// Simple inline styles for a clean CLI feel
const styles = {
  appContainer: { display: 'flex', height: '100vh', backgroundColor: '#282c34', color: '#fff' },
  sidebar: { width: '200px', backgroundColor: '#20232a', padding: '20px', borderRight: '1px solid #3c4049' },
  navLink: { color: '#61dafb', textDecoration: 'none', display: 'block', marginBottom: '10px', fontSize: '1.1em', transition: 'color 0.2s' },
  content: { flexGrow: 1, padding: '20px', overflowY: 'auto' as const },
  header: { color: '#61dafb', marginBottom: '20px', borderBottom: '1px solid #3c4049', paddingBottom: '10px' },
};

function App() {
  return (
    <Router>
      <div style={styles.appContainer}>
        <div style={styles.sidebar}>
          <h2 style={{ color: '#fff', borderBottom: '1px solid #61dafb', paddingBottom: '10px' }}>K3s UI</h2>
          <nav>
            <Link to="/clusters" style={styles.navLink}>🏗️ Clusters</Link>
            <Link to="/terminal" style={styles.navLink}>⚡ Kubectl Terminal</Link>
            <Link to="/nodes" style={styles.navLink}>🌎 Nodes</Link>
            <Link to="/pods" style={styles.navLink}>📦 Pods</Link>
            <Link to="/deployments" style={styles.navLink}>🚀 Deployments</Link>
            <Link to="/services" style={styles.navLink}>⚙️ Services</Link>
          </nav>
        </div>
        <div style={styles.content}>
          <Routes>
            <Route path="/" element={
              <>
                <h1 style={styles.header}>Welcome to K3s Management UI</h1>
                <p>Use the navigation to manage clusters, visualize resources, or run kubectl commands.</p>
              </>
            } />
            <Route path="/clusters" element={<ClustersView />} />
            <Route path="/terminal" element={<KubectlTerminal />} />
            <Route path="/nodes" element={<NodesView />} />
            <Route path="/pods" element={<PodsView />} />
            <Route path="/deployments" element={<DeploymentsView />} />
            <Route path="/services" element={<ServicesView />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;