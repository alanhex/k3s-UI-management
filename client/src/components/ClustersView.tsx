import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Table from './Table';
import { Plus, Check, Trash2, Power, AlertCircle, RefreshCw, X } from 'lucide-react';

interface Cluster {
    name: string;
    serversCount: number;
    agentsCount: number;
    serversRunning: number;
    agentsRunning: number;
    created: string;
    network: {
        name: string;
        [key: string]: any;
    };
}

interface CreateClusterForm {
    name: string;
    agents: number;
    servers: number;
    k3sVersion: string;
    port: string;
}

interface K3dStatus {
    installed: boolean;
    version?: string;
    error?: string;
}

const ClustersView: React.FC = () => {
    const [clusters, setClusters] = useState<Cluster[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [showCreateForm, setShowCreateForm] = useState<boolean>(false);
    const [createForm, setCreateForm] = useState<CreateClusterForm>({
        name: '',
        agents: 1,
        servers: 1,
        k3sVersion: 'latest',
        port: '6443'
    });
    const [creatingCluster, setCreatingCluster] = useState<boolean>(false);
    const [k3dStatus, setK3dStatus] = useState<K3dStatus | null>(null);
    const [checkingK3d, setCheckingK3d] = useState<boolean>(true);

    const fetchClusters = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/api/clusters');
            setClusters(response.data);
            setError(null);
        } catch (err: any) {
            const errorMessage = axios.isAxiosError(err) ? err.response?.data?.details || err.message : 'Failed to fetch clusters';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const checkK3dStatus = async () => {
        try {
            setCheckingK3d(true);
            const response = await axios.get('/api/k3d/status');
            setK3dStatus(response.data);
        } catch (err: any) {
            setK3dStatus({
                installed: false,
                error: axios.isAxiosError(err) ? err.message : 'Failed to check k3d status'
            });
        } finally {
            setCheckingK3d(false);
        }
    };

    useEffect(() => {
        fetchClusters();
        checkK3dStatus();
    }, []);

    const handleCreateCluster = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!createForm.name.trim()) return;

        setCreatingCluster(true);
        try {
            const options = {
                agents: createForm.agents,
                servers: createForm.servers,
                k3sVersion: createForm.k3sVersion,
                port: createForm.port
            };

            await axios.post('/api/clusters', {
                name: createForm.name,
                options
            });

            // Reset form and refresh clusters
            setCreateForm({
                name: '',
                agents: 1,
                servers: 1,
                k3sVersion: 'latest',
                port: '6443'
            });
            setShowCreateForm(false);
            await fetchClusters();
        } catch (err: any) {
            const errorData = axios.isAxiosError(err) ? err.response?.data : null;
            const errorDetails = errorData?.details || err.message;
            const suggestion = errorData?.suggestion || '';

            if (suggestion) {
                setError(`${errorDetails}\n\n${suggestion}`);
            } else {
                setError(errorDetails);
            }
        } finally {
            setCreatingCluster(false);
        }
    };

    const handleDeleteCluster = async (clusterName: string) => {
        if (!window.confirm(`Are you sure you want to delete cluster "${clusterName}"? This action cannot be undone.`)) {
            return;
        }

        try {
            await axios.delete(`/api/clusters/${clusterName}`);
            await fetchClusters();
        } catch (err: any) {
            const errorData = axios.isAxiosError(err) ? err.response?.data : null;
            const errorDetails = errorData?.details || err.message;
            const suggestion = errorData?.suggestion || '';

            if (suggestion) {
                setError(`${errorDetails}\n\n${suggestion}`);
            } else {
                setError(errorDetails);
            }
        }
    };

    const handleSwitchContext = async (clusterName: string) => {
        try {
            await axios.post(`/api/clusters/${clusterName}/switch`);
            alert(`Switched kubectl context to cluster "${clusterName}"`);
        } catch (err: any) {
            setError(axios.isAxiosError(err) ? err.response?.data?.details || err.message : 'Failed to switch context');
        }
    };

    const columns = [
        { key: 'name', label: 'Name' },
        { key: 'serversRunning', label: 'Servers' },
        { key: 'agentsRunning', label: 'Agents' },
        { key: 'network', label: 'Network' },
        { key: 'created', label: 'Created' },
        { key: 'actions', label: 'Actions' },
    ];

    const processedClusters = clusters.map(cluster => ({
        name: (
            <div className="font-medium text-foreground">{cluster.name}</div>
        ),
        serversRunning: (
            <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${cluster.serversRunning === cluster.serversCount ? 'bg-green-500' : 'bg-yellow-500'}`} />
                <span>{cluster.serversRunning}/{cluster.serversCount}</span>
            </div>
        ),
        agentsRunning: (
            <div className="flex items-center gap-2">
                 <div className={`h-2 w-2 rounded-full ${cluster.agentsRunning === cluster.agentsCount ? 'bg-green-500' : 'bg-yellow-500'}`} />
                <span>{cluster.agentsRunning}/{cluster.agentsCount}</span>
            </div>
        ),
        network: <span className="text-muted-foreground">{cluster.network.name || cluster.network}</span>,
        created: <span className="text-muted-foreground">{new Date(cluster.created).toLocaleString()}</span>,
        actions: (
            <div className="flex items-center gap-2">
                <button
                    onClick={() => handleSwitchContext(cluster.name)}
                    className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                    title="Switch Context"
                >
                    <Power className="mr-2 h-4 w-4" />
                    Switch
                </button>
                <button
                    onClick={() => handleDeleteCluster(cluster.name)}
                    className="inline-flex h-8 items-center justify-center rounded-md bg-destructive px-3 text-sm font-medium text-destructive-foreground shadow-sm transition-colors hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                    title="Delete Cluster"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
        ),
    }));

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Clusters</h2>
                    <p className="text-muted-foreground">Manage your local k3d clusters.</p>
                </div>
                <button
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    disabled={!k3dStatus?.installed}
                    className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                >
                    {showCreateForm ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                    {showCreateForm ? 'Cancel' : 'Create Cluster'}
                </button>
            </div>

            {/* k3d Status Card */}
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
                <div className="flex items-center justify-between p-6">
                    <div className="space-y-1">
                        <h3 className="font-semibold leading-none tracking-tight">k3d Status</h3>
                        <p className="text-sm text-muted-foreground">Checks if k3d is installed and ready.</p>
                    </div>
                    {checkingK3d ? (
                        <div className="flex items-center text-muted-foreground">
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Checking...
                        </div>
                    ) : k3dStatus?.installed ? (
                        <div className="flex items-center text-green-500">
                            <Check className="mr-2 h-4 w-4" /> Installed ({k3dStatus.version})
                        </div>
                    ) : (
                        <div className="flex items-center text-destructive">
                            <AlertCircle className="mr-2 h-4 w-4" /> Not Installed
                        </div>
                    )}
                </div>
            </div>

            {showCreateForm && (
                <div className="rounded-lg border bg-card text-card-foreground shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="p-6">
                        <h3 className="text-lg font-semibold mb-4">Create New Cluster</h3>
                        <form onSubmit={handleCreateCluster} className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium leading-none">Cluster Name</label>
                                    <input
                                        type="text"
                                        value={createForm.name}
                                        onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                        placeholder="my-cluster"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium leading-none">Port</label>
                                    <input
                                        type="text"
                                        value={createForm.port}
                                        onChange={(e) => setCreateForm({ ...createForm, port: e.target.value })}
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                        placeholder="6443"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium leading-none">Agents</label>
                                    <input
                                        type="number"
                                        value={createForm.agents}
                                        onChange={(e) => setCreateForm({ ...createForm, agents: parseInt(e.target.value) })}
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                        min="0"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium leading-none">Servers</label>
                                    <input
                                        type="number"
                                        value={createForm.servers}
                                        onChange={(e) => setCreateForm({ ...createForm, servers: parseInt(e.target.value) })}
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                        min="1"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateForm(false)}
                                    className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creatingCluster}
                                    className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                                >
                                    {creatingCluster ? (
                                        <>
                                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Creating...
                                        </>
                                    ) : (
                                        'Create Cluster'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <Table
                data={processedClusters}
                columns={columns}
                loading={loading}
                error={error}
            />
        </div>
    );
};

export default ClustersView;
