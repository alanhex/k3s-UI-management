import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Table from './Table';

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
        } catch (err) {
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
        } catch (err) {
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
        } catch (err) {
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
        } catch (err) {
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
        } catch (err) {
            setError(axios.isAxiosError(err) ? err.response?.data?.details || err.message : 'Failed to switch context');
        }
    };

    const columns = [
        { key: 'name', label: 'Name' },
        { key: 'serversRunning', label: 'Servers Running' },
        { key: 'agentsRunning', label: 'Agents Running' },
        { key: 'network', label: 'Network' },
        { key: 'created', label: 'Created' },
        { key: 'actions', label: 'Actions' },
    ];

    const processedClusters = clusters.map(cluster => ({
        name: cluster.name,
        serversRunning: `${cluster.serversRunning}/${cluster.serversCount}`,
        agentsRunning: `${cluster.agentsRunning}/${cluster.agentsCount}`,
        network: cluster.network.name || cluster.network,
        created: new Date(cluster.created).toLocaleString(),
        actions: (
            <div>
                <button
                    onClick={() => handleSwitchContext(cluster.name)}
                    style={{ marginRight: '5px', padding: '2px 8px', fontSize: '0.8em' }}
                >
                    Switch
                </button>
                <button
                    onClick={() => handleDeleteCluster(cluster.name)}
                    style={{ padding: '2px 8px', fontSize: '0.8em', backgroundColor: '#ff6961', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                >
                    Delete
                </button>
            </div>
        ),
    }));

    const formStyles = {
        form: { marginBottom: '20px', padding: '15px', backgroundColor: '#20232a', borderRadius: '4px' },
        input: { margin: '5px', padding: '8px', backgroundColor: '#333', color: '#fff', border: '1px solid #555', borderRadius: '3px' },
        button: { margin: '5px', padding: '8px 16px', backgroundColor: '#61dafb', color: '#282c34', border: 'none', borderRadius: '3px', cursor: 'pointer' },
        cancelButton: { backgroundColor: '#666' }
    };

    return (
        <div>
            {/* k3d Status Section */}
            <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#20232a', borderRadius: '4px' }}>
                <h3 style={{ color: '#61dafb', marginBottom: '10px' }}>🔧 k3d Status</h3>
                {checkingK3d ? (
                    <p>Checking k3d installation...</p>
                ) : k3dStatus?.installed ? (
                    <div>
                        <p style={{ color: '#4CAF50' }}>✅ k3d is installed (Version: {k3dStatus.version})</p>
                        <p style={{ fontSize: '0.9em', color: '#888' }}>You're ready to manage k3s clusters!</p>
                    </div>
                ) : (
                    <div>
                        <p style={{ color: '#ff6961' }}>❌ k3d is not installed</p>
                        {k3dStatus?.error && <p style={{ fontSize: '0.9em', color: '#ff6961' }}>Error: {k3dStatus.error}</p>}

                        <p style={{ marginTop: '15px' }}>
                            Please install k3d first: <a
                                href="https://k3d.io/stable/#releases"
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: '#61dafb', textDecoration: 'underline' }}
                            >
                                https://k3d.io/stable/#releases
                            </a>
                        </p>

                        <button
                            onClick={checkK3dStatus}
                            style={{ ...formStyles.button, backgroundColor: '#2196F3', marginTop: '10px' }}
                        >
                            Check Again
                        </button>
                    </div>
                )}
            </div>

            <div style={{ marginBottom: '20px' }}>
                <button
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    style={{ ...formStyles.button, backgroundColor: '#4CAF50' }}
                    disabled={!k3dStatus?.installed}
                >
                    {showCreateForm ? 'Cancel' : 'Create New Cluster'}
                </button>
                {!k3dStatus?.installed && (
                    <span style={{ marginLeft: '10px', color: '#888', fontSize: '0.9em' }}>
                        Install k3d first to create clusters
                    </span>
                )}
            </div>

            {showCreateForm && (
                <form onSubmit={handleCreateCluster} style={formStyles.form}>
                    <h3 style={{ color: '#61dafb', marginBottom: '15px' }}>Create New k3s Cluster</h3>
                    <div>
                        <input
                            type="text"
                            placeholder="Cluster Name"
                            value={createForm.name}
                            onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                            style={formStyles.input}
                            required
                        />
                        <input
                            type="number"
                            placeholder="Agents"
                            value={createForm.agents}
                            onChange={(e) => setCreateForm({ ...createForm, agents: parseInt(e.target.value) })}
                            style={formStyles.input}
                            min="0"
                        />
                        <input
                            type="number"
                            placeholder="Servers"
                            value={createForm.servers}
                            onChange={(e) => setCreateForm({ ...createForm, servers: parseInt(e.target.value) })}
                            style={formStyles.input}
                            min="1"
                        />
                        <input
                            type="text"
                            placeholder="k3s Version (e.g., v1.28.0)"
                            value={createForm.k3sVersion}
                            onChange={(e) => setCreateForm({ ...createForm, k3sVersion: e.target.value })}
                            style={formStyles.input}
                        />
                        <input
                            type="text"
                            placeholder="Port (e.g., 6443)"
                            value={createForm.port}
                            onChange={(e) => setCreateForm({ ...createForm, port: e.target.value })}
                            style={formStyles.input}
                        />
                    </div>
                    <div>
                        <button type="submit" style={formStyles.button} disabled={creatingCluster}>
                            {creatingCluster ? 'Creating...' : 'Create Cluster'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowCreateForm(false)}
                            style={{ ...formStyles.button, ...formStyles.cancelButton }}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            )}

            <Table
                data={processedClusters}
                columns={columns}
                title="🏗️ k3s Clusters"
                loading={loading}
                error={error}
            />

            <div style={{ marginTop: '20px', color: '#888', fontSize: '0.9em' }}>
                <p><strong>Note:</strong> Clusters are managed using k3d. Install k3d above if needed.</p>
                <p><strong>⚠️ Docker Required:</strong> k3d requires Docker to be running. Start Docker Desktop before creating clusters.</p>
                <p>Switching context will update your kubectl configuration to point to the selected cluster.</p>
            </div>
        </div>
    );
};

export default ClustersView;