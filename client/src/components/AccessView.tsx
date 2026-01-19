import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Table from './Table';
import { Edit, Trash2, Shield, Users, UserCheck, Lock } from 'lucide-react';
import { YamlEditorModal } from './ActionModals';

interface ServiceAccount {
    metadata: { name: string; namespace: string; creationTimestamp: string; };
    secrets?: Array<{ name: string; }>;
}

interface Role {
    metadata: { name: string; namespace: string; creationTimestamp: string; };
    rules?: any[];
}

interface ClusterRole {
    metadata: { name: string; creationTimestamp: string; };
    rules?: any[];
}

interface RoleBinding {
    metadata: { name: string; namespace: string; creationTimestamp: string; };
    roleRef: { kind: string; name: string; };
    subjects?: Array<{ kind: string; name: string; namespace?: string; }>;
}

const AccessView: React.FC<{ namespace?: string }> = ({ namespace = 'default' }) => {
    const [activeTab, setActiveTab] = useState<'sa' | 'role' | 'clusterrole' | 'binding'>('sa');
    const [sas, setSas] = useState<ServiceAccount[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [clusterRoles, setClusterRoles] = useState<ClusterRole[]>([]);
    const [bindings, setBindings] = useState<RoleBinding[]>([]);
    
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [yaml, setYaml] = useState<string>('');
    const [isYamlOpen, setIsYamlOpen] = useState(false);
    const [selectedResource, setSelectedResource] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);
            if (activeTab === 'sa') {
                const response = await axios.get(`/api/serviceaccounts?namespace=${namespace}`);
                setSas(response.data);
            } else if (activeTab === 'role') {
                const response = await axios.get(`/api/roles?namespace=${namespace}`);
                setRoles(response.data);
            } else if (activeTab === 'clusterrole') {
                const response = await axios.get('/api/clusterroles');
                setClusterRoles(response.data);
            } else {
                const response = await axios.get(`/api/rolebindings?namespace=${namespace}`);
                setBindings(response.data);
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
            case 'sa': return 'serviceaccounts';
            case 'role': return 'roles';
            case 'clusterrole': return 'clusterroles';
            case 'binding': return 'rolebindings';
        }
    };

    const handleDelete = async (name: string) => {
        if (!window.confirm(`Are you sure you want to delete ${name}?`)) return;
        try {
            const url = activeTab === 'clusterrole' 
                ? `/api/resources/${getResourceType()}/${name}`
                : `/api/resources/${getResourceType()}/${name}?namespace=${namespace}`;
            
            await axios.delete(url);
            fetchData();
        } catch (err: any) {
            alert(`Failed to delete: ${err.message}`);
        }
    };

    const handleEditYaml = async (name: string) => {
        try {
            const url = activeTab === 'clusterrole'
                ? `/api/resources/${getResourceType()}/${name}/yaml`
                : `/api/resources/${getResourceType()}/${name}/yaml?namespace=${namespace}`;
            
            const response = await axios.get(url);
            setYaml(response.data.yaml);
            setSelectedResource(name);
            setIsYamlOpen(true);
        } catch (err: any) {
            alert('Failed to fetch YAML');
        }
    };

    const saColumns = [
        { key: 'metadata.name', label: 'Name' },
        { key: 'metadata.namespace', label: 'Namespace' },
        { key: 'secrets', label: 'Secrets' },
        { key: 'metadata.creationTimestamp', label: 'Created' },
        { key: 'actions', label: 'Actions' },
    ];

    const roleColumns = [
        { key: 'metadata.name', label: 'Name' },
        { key: 'metadata.namespace', label: 'Namespace' },
        { key: 'metadata.creationTimestamp', label: 'Created' },
        { key: 'actions', label: 'Actions' },
    ];

    const crColumns = [
        { key: 'metadata.name', label: 'Name' },
        { key: 'metadata.creationTimestamp', label: 'Created' },
        { key: 'actions', label: 'Actions' },
    ];

    const bindingColumns = [
        { key: 'metadata.name', label: 'Name' },
        { key: 'metadata.namespace', label: 'Namespace' },
        { key: 'roleRef', label: 'Role Ref' },
        { key: 'subjects', label: 'Subjects' },
        { key: 'metadata.creationTimestamp', label: 'Created' },
        { key: 'actions', label: 'Actions' },
    ];

    const processedSas = sas.map(sa => ({
        'metadata.name': <span className="font-medium text-foreground">{sa.metadata.name}</span>,
        'metadata.namespace': <span className="text-muted-foreground">{sa.metadata.namespace}</span>,
        'secrets': <span className="font-mono text-xs">{sa.secrets?.length || 0}</span>,
        'metadata.creationTimestamp': new Date(sa.metadata.creationTimestamp).toLocaleString(),
        'actions': (
            <div className="flex items-center gap-2">
                <button onClick={() => handleEditYaml(sa.metadata.name)} className="p-1 hover:bg-muted rounded" title="Edit YAML">
                    <Edit className="h-4 w-4" />
                </button>
                <button onClick={() => handleDelete(sa.metadata.name)} className="p-1 hover:bg-destructive/10 text-destructive rounded" title="Delete">
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
        )
    }));

    const processedRoles = roles.map(r => ({
        'metadata.name': <span className="font-medium text-foreground">{r.metadata.name}</span>,
        'metadata.namespace': <span className="text-muted-foreground">{r.metadata.namespace}</span>,
        'metadata.creationTimestamp': new Date(r.metadata.creationTimestamp).toLocaleString(),
        'actions': (
            <div className="flex items-center gap-2">
                <button onClick={() => handleEditYaml(r.metadata.name)} className="p-1 hover:bg-muted rounded" title="Edit YAML">
                    <Edit className="h-4 w-4" />
                </button>
                <button onClick={() => handleDelete(r.metadata.name)} className="p-1 hover:bg-destructive/10 text-destructive rounded" title="Delete">
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
        )
    }));

    const processedCRs = clusterRoles.map(cr => ({
        'metadata.name': <span className="font-medium text-foreground">{cr.metadata.name}</span>,
        'metadata.creationTimestamp': new Date(cr.metadata.creationTimestamp).toLocaleString(),
        'actions': (
            <div className="flex items-center gap-2">
                <button onClick={() => handleEditYaml(cr.metadata.name)} className="p-1 hover:bg-muted rounded" title="Edit YAML">
                    <Edit className="h-4 w-4" />
                </button>
                <button onClick={() => handleDelete(cr.metadata.name)} className="p-1 hover:bg-destructive/10 text-destructive rounded" title="Delete">
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
        )
    }));

    const processedBindings = bindings.map(b => ({
        'metadata.name': <span className="font-medium text-foreground">{b.metadata.name}</span>,
        'metadata.namespace': <span className="text-muted-foreground">{b.metadata.namespace}</span>,
        'roleRef': <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">{b.roleRef.kind}/{b.roleRef.name}</span>,
        'subjects': (
            <div className="flex flex-wrap gap-1">
                {b.subjects?.map((s, i) => (
                    <span key={i} className="inline-flex items-center rounded-md bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-500">
                        {s.kind}/{s.name}
                    </span>
                )) || '-'}
            </div>
        ),
        'metadata.creationTimestamp': new Date(b.metadata.creationTimestamp).toLocaleString(),
        'actions': (
            <div className="flex items-center gap-2">
                <button onClick={() => handleEditYaml(b.metadata.name)} className="p-1 hover:bg-muted rounded" title="Edit YAML">
                    <Edit className="h-4 w-4" />
                </button>
                <button onClick={() => handleDelete(b.metadata.name)} className="p-1 hover:bg-destructive/10 text-destructive rounded" title="Delete">
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
        )
    }));

    const getData = () => {
        switch (activeTab) {
            case 'sa': return processedSas;
            case 'role': return processedRoles;
            case 'clusterrole': return processedCRs;
            case 'binding': return processedBindings;
        }
    };

    const getColumns = () => {
        switch (activeTab) {
            case 'sa': return saColumns;
            case 'role': return roleColumns;
            case 'clusterrole': return crColumns;
            case 'binding': return bindingColumns;
        }
    };

    return (
        <div>
            <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Access Control (RBAC)</h2>
                        <p className="text-muted-foreground">Manage permissions and identities.</p>
                    </div>
                    <button 
                        onClick={() => {
                            let template = '';
                            if (activeTab === 'sa') {
                                template = 'apiVersion: v1\nkind: ServiceAccount\nmetadata:\n  name: my-sa';
                            } else if (activeTab === 'role') {
                                template = 'apiVersion: rbac.authorization.k8s.io/v1\nkind: Role\nmetadata:\n  name: my-role\nrules:\n- apiGroups: [""]\n  resources: ["pods"]\n  verbs: ["get", "list"]';
                            } else if (activeTab === 'clusterrole') {
                                template = 'apiVersion: rbac.authorization.k8s.io/v1\nkind: ClusterRole\nmetadata:\n  name: my-cluster-role\nrules:\n- apiGroups: [""]\n  resources: ["nodes"]\n  verbs: ["get", "list"]';
                            } else {
                                template = 'apiVersion: rbac.authorization.k8s.io/v1\nkind: RoleBinding\nmetadata:\n  name: my-role-binding\nsubjects:\n- kind: User\n  name: jane\n  apiGroup: rbac.authorization.k8s.io\nroleRef:\n  kind: Role\n  name: my-role\n  apiGroup: rbac.authorization.k8s.io';
                            }
                            setYaml(template);
                            setSelectedResource(null);
                            setIsYamlOpen(true);
                        }}
                        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
                    >
                        Create {activeTab === 'sa' ? 'ServiceAccount' : activeTab === 'role' ? 'Role' : activeTab === 'clusterrole' ? 'ClusterRole' : 'Binding'}
                    </button>
                </div>

                <div className="flex space-x-1 rounded-lg bg-muted p-1 w-fit mb-4 overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('sa')}
                        className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                            activeTab === 'sa' 
                                ? 'bg-background text-foreground shadow-sm' 
                                : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
                        }`}
                    >
                        <Users className="h-4 w-4" />
                        ServiceAccounts
                    </button>
                    <button
                        onClick={() => setActiveTab('role')}
                        className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                            activeTab === 'role' 
                                ? 'bg-background text-foreground shadow-sm' 
                                : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
                        }`}
                    >
                        <Shield className="h-4 w-4" />
                        Roles
                    </button>
                    <button
                        onClick={() => setActiveTab('clusterrole')}
                        className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                            activeTab === 'clusterrole' 
                                ? 'bg-background text-foreground shadow-sm' 
                                : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
                        }`}
                    >
                        <Lock className="h-4 w-4" />
                        ClusterRoles
                    </button>
                    <button
                        onClick={() => setActiveTab('binding')}
                        className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                            activeTab === 'binding' 
                                ? 'bg-background text-foreground shadow-sm' 
                                : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
                        }`}
                    >
                        <UserCheck className="h-4 w-4" />
                        RoleBindings
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
                resourceType={activeTab === 'sa' ? 'ServiceAccount' : activeTab === 'role' ? 'Role' : activeTab === 'clusterrole' ? 'ClusterRole' : 'RoleBinding'}
                resourceName={selectedResource || undefined}
            />
        </div>
    );
};

export default AccessView;
