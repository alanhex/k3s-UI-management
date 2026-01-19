import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Link } from 'react-router-dom';
import { 
  Terminal, 
  Server, 
  Box, 
  Layers, 
  Settings, 
  LayoutGrid, 
  Menu,
  Ghost,
  Copy,
  HardDrive,
  FileText,
  Globe,
  Shield,
  Package
} from 'lucide-react';
import KubectlTerminal from './components/KubectlTerminal';
import NodesView from './components/NodesView';
import PodsView from './components/PodsView';
import DeploymentsView from './components/DeploymentsView';
import ServicesView from './components/ServicesView';
import ClustersView from './components/ClustersView';
import DaemonSetsView from './components/DaemonSetsView';
import ReplicaSetsView from './components/ReplicaSetsView';
import NamespacesView from './components/NamespacesView';
import NamespaceSelector from './components/NamespaceSelector';
import StorageView from './components/StorageView';
import ConfigView from './components/ConfigView';
import IngressesView from './components/IngressesView';
import AccessView from './components/AccessView';
import HelmView from './components/HelmView';
import DashboardView from './components/DashboardView';

const NavItem = ({ to, icon: Icon, children }: { to: string; icon: any; children: React.ReactNode }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary ${
        isActive ? 'bg-muted text-primary' : 'text-muted-foreground'
      }`
    }
  >
    <Icon className="h-4 w-4" />
    {children}
  </NavLink>
);

function App() {
  const [namespace, setNamespace] = useState('default');

  return (
    <Router>
      <div className="flex h-screen w-full bg-background font-sans text-foreground">
        {/* Sidebar */}
        <div className="hidden border-r bg-muted/40 md:block md:w-64 lg:w-72">
          <div className="flex h-full max-h-screen flex-col gap-2">
            <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
              <Link to="/" className="flex items-center gap-2 font-semibold">
                <LayoutGrid className="h-6 w-6 text-primary" />
                <span className="">K3s Manager</span>
              </Link>
            </div>
            <div className="flex-1 overflow-auto">
              <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Cluster
                </div>
                <NavItem to="/dashboard" icon={LayoutGrid}>Dashboard</NavItem>
                <NavItem to="/clusters" icon={LayoutGrid}>Clusters</NavItem>
                <NavItem to="/namespaces" icon={Layers}>Namespaces</NavItem>
                <NavItem to="/nodes" icon={Server}>Nodes</NavItem>
                
                <div className="px-3 py-2 mt-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Workloads
                </div>
                <NavItem to="/pods" icon={Box}>Pods</NavItem>
                <NavItem to="/deployments" icon={Layers}>Deployments</NavItem>
                <NavItem to="/daemonsets" icon={Ghost}>DaemonSets</NavItem>
                <NavItem to="/replicasets" icon={Copy}>ReplicaSets</NavItem>
                
                <div className="px-3 py-2 mt-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Config & Storage
                </div>
                <NavItem to="/storage" icon={HardDrive}>Storage</NavItem>
                <NavItem to="/config" icon={FileText}>Config</NavItem>

                <div className="px-3 py-2 mt-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Network
                </div>
                <NavItem to="/services" icon={Settings}>Services</NavItem>
                <NavItem to="/ingresses" icon={Globe}>Ingresses</NavItem>
                
                <div className="px-3 py-2 mt-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Access & System
                </div>
                <NavItem to="/access" icon={Shield}>Access Control</NavItem>
                <NavItem to="/helm" icon={Package}>Helm (k3s)</NavItem>

                <div className="px-3 py-2 mt-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Tools
                </div>
                <NavItem to="/terminal" icon={Terminal}>Terminal</NavItem>
              </nav>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6 justify-between">
            <div className="flex items-center gap-4">
              <div className="md:hidden">
                <Menu className="h-6 w-6" />
              </div>
              <h1 className="text-lg font-semibold md:text-xl">Dashboard</h1>
            </div>
            <div className="flex items-center gap-4">
              <NamespaceSelector selected={namespace} onSelect={setNamespace} />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 lg:p-6">
            <Routes>
              <Route path="/" element={<DashboardView />} />
              <Route path="/dashboard" element={<DashboardView />} />
              <Route path="/clusters" element={<ClustersView />} />
              <Route path="/namespaces" element={<NamespacesView />} />
              <Route path="/terminal" element={<KubectlTerminal />} />
              <Route path="/nodes" element={<NodesView />} />
              <Route path="/pods" element={<PodsView namespace={namespace} />} />
              <Route path="/deployments" element={<DeploymentsView namespace={namespace} />} />
              <Route path="/services" element={<ServicesView namespace={namespace} />} />
              <Route path="/daemonsets" element={<DaemonSetsView namespace={namespace} />} />
              <Route path="/replicasets" element={<ReplicaSetsView namespace={namespace} />} />
              <Route path="/storage" element={<StorageView namespace={namespace} />} />
              <Route path="/config" element={<ConfigView namespace={namespace} />} />
              <Route path="/ingresses" element={<IngressesView namespace={namespace} />} />
              <Route path="/access" element={<AccessView namespace={namespace} />} />
              <Route path="/helm" element={<HelmView namespace={namespace} />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;
