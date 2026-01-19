import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Table from './Table';
import { Edit, Trash2, Database, HardDrive, Disc } from 'lucide-react';
import { YamlEditorModal } from './ActionModals';

interface PersistentVolume {
    metadata: { name: string; creationTimestamp: string; };
    spec: {
        capacity?: { storage: string; };
        accessModes?: string[];
        persistentVolumeReclaimPolicy?: string;
        storageClassName?: string;
        claimRef?: { name: string; namespace: string; };
    };
    status: { phase: string; };
}

interface PersistentVolumeClaim {
    metadata: { name: string; namespace: string; creationTimestamp: string; };
    spec: {
        accessModes?: string[];
        storageClassName?: string;
        volumeName?: string;
        resources?: { requests?: { storage: string; }; };
    };
    status: { phase: string; };
}

interface StorageClass {
    metadata: { name: string; creationTimestamp: string; };
    provisioner: string;
    reclaimPolicy?: string;
}

const StorageView: React.FC<{ namespace?: string }> = ({ namespace = 'default' }) => {
    const [activeTab, setActiveTab] = useState<'pv' | 'pvc' | 'sc'>('pvc');
    const [pvs, setPvs] = useState<PersistentVolume[]>([]);
    const [pvcs, setPvcs] = useState<PersistentVolumeClaim[]>([]);
    const [scs, setScs] = useState<StorageClass[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [yaml, setYaml] = useState<string>('');
    const [isYamlOpen, setIsYamlOpen] = useState(false);
    const [selectedResource, setSelectedResource] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);
            if (activeTab === 'pv') {
                const response = await axios.get('/api/persistentvolumes');
                setPvs(response.data);
            } else if (activeTab === 'pvc') {
                const response = await axios.get(`/api/persistentvolumeclaims?namespace=${namespace}`);
                setPvcs(response.data);
            } else {
                const response = await axios.get('/api/storageclasses');
                setScs(response.data);
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

    const getResourceType = () => {
        switch (activeTab) {
            case 'pv': return 'persistentvolumes';
            case 'pvc': return 'persistentvolumeclaims';
            case 'sc': return 'storageclasses';
        }
    };

    const handleDelete = async (name: string) => {
        if (!window.confirm(`Are you sure you want to delete ${name}?`)) return;
        try {
            // PV and SC are cluster-scoped, PVC is namespaced
            const url = activeTab === 'pvc' 
                ? `/api/resources/${getResourceType()}/${name}?namespace=${namespace}`
                : `/api/resources/${getResourceType()}/${name}`;
            
            await axios.delete(url);
            fetchData();
        } catch (err: any) {
            alert(`Failed to delete: ${err.message}`);
        }
    };

    const handleEditYaml = async (name: string) => {
        try {
            const url = activeTab === 'pvc'
                ? `/api/resources/${getResourceType()}/${name}/yaml?namespace=${namespace}`
                : `/api/resources/${getResourceType()}/${name}/yaml`;
            
            const response = await axios.get(url);
            setYaml(response.data.yaml);
            setSelectedResource(name);
            setIsYamlOpen(true);
        } catch (err: any) {
            alert('Failed to fetch YAML');
        }
    };

    const pvColumns = [
        { key: 'metadata.name', label: 'Name' },
        { key: 'spec.capacity.storage', label: 'Capacity' },
        { key: 'status.phase', label: 'Status' },
        { key: 'spec.claimRef', label: 'Claim' },
        { key: 'spec.storageClassName', label: 'StorageClass' },
        { key: 'metadata.creationTimestamp', label: 'Created' },
        { key: 'actions', label: 'Actions' },
    ];

    const pvcColumns = [
        { key: 'metadata.name', label: 'Name' },
        { key: 'metadata.namespace', label: 'Namespace' },
        { key: 'status.phase', label: 'Status' },
        { key: 'spec.volumeName', label: 'Volume' },
        { key: 'spec.resources.requests.storage', label: 'Request' },
        { key: 'metadata.creationTimestamp', label: 'Created' },
        { key: 'actions', label: 'Actions' },
    ];

    const scColumns = [
        { key: 'metadata.name', label: 'Name' },
        { key: 'provisioner', label: 'Provisioner' },
        { key: 'reclaimPolicy', label: 'Reclaim Policy' },
        { key: 'metadata.creationTimestamp', label: 'Created' },
        { key: 'actions', label: 'Actions' },
    ];

    const processedPvs = pvs.map(pv => ({
        'metadata.name': <span className="font-medium text-foreground">{pv.metadata.name}</span>,
        'spec.capacity.storage': pv.spec.capacity?.storage || '-',
        'status.phase': (
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                pv.status.phase === 'Bound' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'
            }`}>
                {pv.status.phase}
            </span>
        ),
        'spec.claimRef': pv.spec.claimRef ? `${pv.spec.claimRef.namespace}/${pv.spec.claimRef.name}` : '-',
        'spec.storageClassName': pv.spec.storageClassName || '-',
        'metadata.creationTimestamp': new Date(pv.metadata.creationTimestamp).toLocaleString(),
        'actions': (
            <div className="flex items-center gap-2">
                <button onClick={() => handleEditYaml(pv.metadata.name)} className="p-1 hover:bg-muted rounded" title="Edit YAML">
                    <Edit className="h-4 w-4" />
                </button>
                <button onClick={() => handleDelete(pv.metadata.name)} className="p-1 hover:bg-destructive/10 text-destructive rounded" title="Delete">
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
        )
    }));

    const processedPvcs = pvcs.map(pvc => ({
        'metadata.name': <span className="font-medium text-foreground">{pvc.metadata.name}</span>,
        'metadata.namespace': <span className="text-muted-foreground">{pvc.metadata.namespace}</span>,
        'status.phase': (
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                pvc.status.phase === 'Bound' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'
            }`}>
                {pvc.status.phase}
            </span>
        ),
        'spec.volumeName': pvc.spec.volumeName || '-',
        'spec.resources.requests.storage': pvc.spec.resources?.requests?.storage || '-',
        'metadata.creationTimestamp': new Date(pvc.metadata.creationTimestamp).toLocaleString(),
        'actions': (
            <div className="flex items-center gap-2">
                <button onClick={() => handleEditYaml(pvc.metadata.name)} className="p-1 hover:bg-muted rounded" title="Edit YAML">
                    <Edit className="h-4 w-4" />
                </button>
                <button onClick={() => handleDelete(pvc.metadata.name)} className="p-1 hover:bg-destructive/10 text-destructive rounded" title="Delete">
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
        )
    }));

    const processedScs = scs.map(sc => ({
        'metadata.name': <span className="font-medium text-foreground">{sc.metadata.name}</span>,
        'provisioner': <span className="font-mono text-xs">{sc.provisioner}</span>,
        'reclaimPolicy': sc.reclaimPolicy || '-',
        'metadata.creationTimestamp': new Date(sc.metadata.creationTimestamp).toLocaleString(),
        'actions': (
            <div className="flex items-center gap-2">
                <button onClick={() => handleEditYaml(sc.metadata.name)} className="p-1 hover:bg-muted rounded" title="Edit YAML">
                    <Edit className="h-4 w-4" />
                </button>
                <button onClick={() => handleDelete(sc.metadata.name)} className="p-1 hover:bg-destructive/10 text-destructive rounded" title="Delete">
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
        )
    }));

    const getData = () => {
        switch (activeTab) {
            case 'pv': return processedPvs;
            case 'pvc': return processedPvcs;
            case 'sc': return processedScs;
        }
    };

    const getColumns = () => {
        switch (activeTab) {
            case 'pv': return pvColumns;
            case 'pvc': return pvcColumns;
            case 'sc': return scColumns;
        }
    };

    return (
        <div>
            <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Storage</h2>
                        <p className="text-muted-foreground">Manage volumes and storage classes.</p>
                    </div>
                    <button 
                        onClick={() => {
                            let template = '';
                            if (activeTab === 'pvc') {
                                template = 'apiVersion: v1\nkind: PersistentVolumeClaim\nmetadata:\n  name: my-pvc\nspec:\n  accessModes:\n    - ReadWriteOnce\n  resources:\n    requests:\n      storage: 1Gi';
                            } else if (activeTab === 'pv') {
                                template = 'apiVersion: v1\nkind: PersistentVolume\nmetadata:\n  name: my-pv\nspec:\n  capacity:\n    storage: 5Gi\n  accessModes:\n    - ReadWriteOnce\n  hostPath:\n    path: "/mnt/data"';
                            } else {
                                template = 'apiVersion: storage.k8s.io/v1\nkind: StorageClass\nmetadata:\n  name: my-storage-class\nprovisioner: kubernetes.io/no-provisioner\nreclaimPolicy: Delete';
                            }
                            setYaml(template);
                            setSelectedResource(null);
                            setIsYamlOpen(true);
                        }}
                        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
                    >
                        Create {activeTab.toUpperCase()}
                    </button>
                </div>

                <div className="flex space-x-1 rounded-lg bg-muted p-1 w-fit mb-4">
                    <button
                        onClick={() => setActiveTab('pvc')}
                        className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                            activeTab === 'pvc' 
                                ? 'bg-background text-foreground shadow-sm' 
                                : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
                        }`}
                    >
                        <Disc className="h-4 w-4" />
                        Claims (PVC)
                    </button>
                    <button
                        onClick={() => setActiveTab('pv')}
                        className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                            activeTab === 'pv' 
                                ? 'bg-background text-foreground shadow-sm' 
                                : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
                        }`}
                    >
                        <HardDrive className="h-4 w-4" />
                        Volumes (PV)
                    </button>
                    <button
                        onClick={() => setActiveTab('sc')}
                        className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                            activeTab === 'sc' 
                                ? 'bg-background text-foreground shadow-sm' 
                                : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
                        }`}
                    >
                        <Database className="h-4 w-4" />
                        Storage Classes
                    </button>
                </div>
            </div>
            
            <Table
                data={getData()}
                columns={getColumns()}
                loading={loading}
                error={error}
            />

            <YamlEditorModal 
                isOpen={isYamlOpen} 
                onClose={() => setIsYamlOpen(false)} 
                initialYaml={yaml}
                onSave={fetchData}
                resourceType={activeTab === 'pvc' ? 'PersistentVolumeClaim' : activeTab === 'pv' ? 'PersistentVolume' : 'StorageClass'}
                resourceName={selectedResource || undefined}
            />
        </div>
    );
};

export default StorageView;
