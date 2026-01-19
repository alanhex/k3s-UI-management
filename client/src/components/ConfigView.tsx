import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Table from './Table';
import { Edit, Trash2, Eye, EyeOff, FileText, Lock } from 'lucide-react';
import { YamlEditorModal } from './ActionModals';

interface ConfigMap {
    metadata: {
        name: string;
        namespace: string;
        creationTimestamp: string;
    };
    data?: Record<string, string>;
}

interface Secret {
    metadata: {
        name: string;
        namespace: string;
        creationTimestamp: string;
    };
    type: string;
    data?: Record<string, string>;
}

const ConfigView: React.FC<{ namespace?: string }> = ({ namespace = 'default' }) => {
    const [activeTab, setActiveTab] = useState<'configmaps' | 'secrets'>('configmaps');
    const [configMaps, setConfigMaps] = useState<ConfigMap[]>([]);
    const [secrets, setSecrets] = useState<Secret[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [yaml, setYaml] = useState<string>('');
    const [isYamlOpen, setIsYamlOpen] = useState(false);
    const [selectedResource, setSelectedResource] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);
            if (activeTab === 'configmaps') {
                const response = await axios.get(`/api/configmaps?namespace=${namespace}`);
                setConfigMaps(response.data);
            } else {
                const response = await axios.get(`/api/secrets?namespace=${namespace}`);
                setSecrets(response.data);
            }
        } catch (err: any) {
            setError(axios.isAxiosError(err) ? err.message : `Failed to fetch ${activeTab}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [namespace, activeTab]);

    const handleDelete = async (name: string) => {
        if (!window.confirm(`Are you sure you want to delete ${name}?`)) return;
        try {
            await axios.delete(`/api/resources/${activeTab}/${name}?namespace=${namespace}`);
            fetchData();
        } catch (err: any) {
            alert(`Failed to delete: ${err.message}`);
        }
    };

    const handleEditYaml = async (name: string) => {
        try {
            const response = await axios.get(`/api/resources/${activeTab}/${name}/yaml?namespace=${namespace}`);
            setYaml(response.data.yaml);
            setSelectedResource(name);
            setIsYamlOpen(true);
        } catch (err: any) {
            alert('Failed to fetch YAML');
        }
    };

    const cmColumns = [
        { key: 'metadata.name', label: 'Name' },
        { key: 'metadata.namespace', label: 'Namespace' },
        { key: 'data', label: 'Data (Keys)' },
        { key: 'metadata.creationTimestamp', label: 'Created' },
        { key: 'actions', label: 'Actions' },
    ];

    const secretColumns = [
        { key: 'metadata.name', label: 'Name' },
        { key: 'metadata.namespace', label: 'Namespace' },
        { key: 'type', label: 'Type' },
        { key: 'data', label: 'Data (Keys)' },
        { key: 'metadata.creationTimestamp', label: 'Created' },
        { key: 'actions', label: 'Actions' },
    ];

    const processedCMs = configMaps.map(cm => ({
        'metadata.name': <span className="font-medium text-foreground">{cm.metadata.name}</span>,
        'metadata.namespace': <span className="text-muted-foreground">{cm.metadata.namespace}</span>,
        'data': (
            <div className="flex flex-wrap gap-1">
                {cm.data ? Object.keys(cm.data).map(k => (
                    <span key={k} className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-mono text-muted-foreground">
                        {k}
                    </span>
                )) : <span className="text-muted-foreground">-</span>}
            </div>
        ),
        'metadata.creationTimestamp': new Date(cm.metadata.creationTimestamp).toLocaleString(),
        'actions': (
            <div className="flex items-center gap-2">
                <button onClick={() => handleEditYaml(cm.metadata.name)} className="p-1 hover:bg-muted rounded" title="Edit YAML">
                    <Edit className="h-4 w-4" />
                </button>
                <button onClick={() => handleDelete(cm.metadata.name)} className="p-1 hover:bg-destructive/10 text-destructive rounded" title="Delete">
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
        )
    }));

    const processedSecrets = secrets.map(secret => ({
        'metadata.name': <span className="font-medium text-foreground">{secret.metadata.name}</span>,
        'metadata.namespace': <span className="text-muted-foreground">{secret.metadata.namespace}</span>,
        'type': <span className="font-mono text-xs">{secret.type}</span>,
        'data': (
            <div className="flex flex-wrap gap-1">
                {secret.data ? Object.keys(secret.data).map(k => (
                    <span key={k} className="inline-flex items-center rounded-md bg-yellow-500/10 px-2 py-1 text-xs font-mono text-yellow-500">
                        {k}
                    </span>
                )) : <span className="text-muted-foreground">-</span>}
            </div>
        ),
        'metadata.creationTimestamp': new Date(secret.metadata.creationTimestamp).toLocaleString(),
        'actions': (
            <div className="flex items-center gap-2">
                <button onClick={() => handleEditYaml(secret.metadata.name)} className="p-1 hover:bg-muted rounded" title="Edit YAML">
                    <Edit className="h-4 w-4" />
                </button>
                <button onClick={() => handleDelete(secret.metadata.name)} className="p-1 hover:bg-destructive/10 text-destructive rounded" title="Delete">
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
        )
    }));

    return (
        <div>
            <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Configuration</h2>
                        <p className="text-muted-foreground">Manage ConfigMaps and Secrets.</p>
                    </div>
                    <button 
                        onClick={() => {
                            const template = activeTab === 'configmaps' 
                                ? 'apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: my-config\ndata:\n  key: value'
                                : 'apiVersion: v1\nkind: Secret\nmetadata:\n  name: my-secret\ntype: Opaque\ndata:\n  key: dmFsdWU= # base64 encoded "value"';
                            setYaml(template);
                            setSelectedResource(null);
                            setIsYamlOpen(true);
                        }}
                        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
                    >
                        Create {activeTab === 'configmaps' ? 'ConfigMap' : 'Secret'}
                    </button>
                </div>

                <div className="flex space-x-1 rounded-lg bg-muted p-1 w-fit mb-4">
                    <button
                        onClick={() => setActiveTab('configmaps')}
                        className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                            activeTab === 'configmaps' 
                                ? 'bg-background text-foreground shadow-sm' 
                                : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
                        }`}
                    >
                        <FileText className="h-4 w-4" />
                        ConfigMaps
                    </button>
                    <button
                        onClick={() => setActiveTab('secrets')}
                        className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                            activeTab === 'secrets' 
                                ? 'bg-background text-foreground shadow-sm' 
                                : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
                        }`}
                    >
                        <Lock className="h-4 w-4" />
                        Secrets
                    </button>
                </div>
            </div>
            
            <Table
                data={activeTab === 'configmaps' ? processedCMs : processedSecrets}
                columns={activeTab === 'configmaps' ? cmColumns : secretColumns}
                loading={loading}
                error={error}
            />

            <YamlEditorModal 
                isOpen={isYamlOpen} 
                onClose={() => setIsYamlOpen(false)} 
                initialYaml={yaml}
                onSave={fetchData}
                resourceType={activeTab === 'configmaps' ? 'ConfigMap' : 'Secret'}
                resourceName={selectedResource || undefined}
            />
        </div>
    );
};

export default ConfigView;
