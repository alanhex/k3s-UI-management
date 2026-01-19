import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Table from './Table';
import { Edit, Trash2, Network, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { YamlEditorModal } from './ActionModals';

interface Ingress {
    metadata: {
        name: string;
        namespace: string;
        creationTimestamp: string;
    };
    spec: {
        rules?: Array<{
            host?: string;
            http?: {
                paths: Array<{
                    path?: string;
                    backend: {
                        service: {
                            name: string;
                            port: {
                                number?: number;
                                name?: string;
                            };
                        };
                    };
                }>;
            };
        }>;
    };
    status: {
        loadBalancer?: {
            ingress?: Array<{
                ip?: string;
                hostname?: string;
            }>;
        };
    };
}

const IngressesView: React.FC<{ namespace?: string }> = ({ namespace = 'default' }) => {
    const [activeTab, setActiveTab] = useState<'ingresses' | 'topology'>('ingresses');
    const [ingresses, setIngresses] = useState<Ingress[]>([]);
    const [services, setServices] = useState<any[]>([]);
    const [pods, setPods] = useState<any[]>([]);
    const [deployments, setDeployments] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedIngress, setSelectedIngress] = useState<Ingress | null>(null);
    const [yaml, setYaml] = useState<string>('');
    const [isYamlOpen, setIsYamlOpen] = useState(false);

    const fetchIngresses = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`/api/ingresses?namespace=${namespace}`);
            setIngresses(response.data);
        } catch (err: any) {
            setError(axios.isAxiosError(err) ? err.message : 'Failed to fetch ingresses');
        } finally {
            setLoading(false);
        }
    };

    const fetchTopology = async () => {
        try {
            setLoading(true);
            setError(null);
            const [servicesRes, podsRes, ingressesRes, deploymentsRes] = await Promise.all([
                axios.get(`/api/services?namespace=${namespace}`),
                axios.get(`/api/pods?namespace=${namespace}`),
                axios.get(`/api/ingresses?namespace=${namespace}`),
                axios.get(`/api/deployments?namespace=${namespace}`)
            ]);
            setServices(servicesRes.data);
            setPods(podsRes.data);
            setIngresses(ingressesRes.data);
            setDeployments(deploymentsRes.data);
        } catch (err: any) {
            setError(axios.isAxiosError(err) ? err.message : 'Failed to fetch topology data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'ingresses') {
            fetchIngresses();
        } else {
            fetchTopology();
        }
    }, [namespace, activeTab]);

    const buildTopology = () => {
        const connections: string[] = [];

        // Service to Pods connections
        services.forEach(service => {
            if (service.spec?.selector) {
                const selector = service.spec.selector;
                const matchingPods = pods.filter(pod => {
                    return Object.entries(selector).every(([key, value]) => pod.metadata?.labels?.[key] === value);
                });
                if (matchingPods.length > 0) {
                    connections.push(`Service ${service.metadata?.name} → Pods: ${matchingPods.map(p => p.metadata?.name).join(', ')}`);
                }
            }
        });

        // Ingress to Service connections
        ingresses.forEach(ingress => {
            ingress.spec?.rules?.forEach(rule => {
                rule.http?.paths?.forEach(path => {
                    const serviceName = path.backend?.service?.name;
                    if (serviceName) {
                        connections.push(`Ingress ${ingress.metadata?.name} (${rule.host || '*'}${path.path || '/'}) → Service ${serviceName}`);
                    }
                });
            });
        });

        return connections;
    };

    const handleDelete = async (name: string, namespace: string) => {
        if (!window.confirm(`Are you sure you want to delete ingress ${name}?`)) return;
        try {
            await axios.delete(`/api/resources/ingresses/${name}?namespace=${namespace}`);
            fetchIngresses();
        } catch (err: any) {
            alert(`Failed to delete: ${err.message}`);
        }
    };

    const handleEditYaml = async (name: string, namespace: string) => {
        try {
            const response = await axios.get(`/api/resources/ingresses/${name}/yaml?namespace=${namespace}`);
            setYaml(response.data.yaml);
            setSelectedIngress(ingresses.find(i => i.metadata.name === name) || null);
            setIsYamlOpen(true);
        } catch (err: any) {
            alert('Failed to fetch YAML');
        }
    };

    const columns = [
        { key: 'metadata.name', label: 'Name' },
        { key: 'metadata.namespace', label: 'Namespace' },
        { key: 'spec.rules', label: 'Rules (Host -> Path -> Service)' },
        { key: 'status.loadBalancer', label: 'Address' },
        { key: 'metadata.creationTimestamp', label: 'Created' },
        { key: 'actions', label: 'Actions' },
    ];

    const processedIngresses = ingresses.map(ingress => {
        const rules = ingress.spec.rules?.map((rule, i) => (
            <div key={i} className="text-xs mb-1">
                <span className="font-semibold text-blue-400">{rule.host || '*'}</span>
                {rule.http?.paths.map((path, j) => (
                    <div key={j} className="ml-2 text-muted-foreground">
                        {path.path || '/'} ➝ {path.backend.service.name}:{path.backend.service.port.number || path.backend.service.port.name}
                    </div>
                ))}
            </div>
        ));

        const address = ingress.status.loadBalancer?.ingress?.map(i => i.ip || i.hostname).join(', ') || '-';

        return {
            'metadata.name': <span className="font-medium text-foreground">{ingress.metadata.name}</span>,
            'metadata.namespace': <span className="text-muted-foreground">{ingress.metadata.namespace}</span>,
            'spec.rules': <div>{rules || '-'}</div>,
            'status.loadBalancer': <span className="font-mono text-xs">{address}</span>,
            'metadata.creationTimestamp': new Date(ingress.metadata.creationTimestamp).toLocaleString(),
            'actions': (
                <div className="flex items-center gap-2">
                    <button onClick={() => handleEditYaml(ingress.metadata.name, ingress.metadata.namespace)} className="p-1 hover:bg-muted rounded" title="Edit YAML">
                        <Edit className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(ingress.metadata.name, ingress.metadata.namespace)} className="p-1 hover:bg-destructive/10 text-destructive rounded" title="Delete">
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            )
        };
    });

    return (
        <div>
            <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Network Management</h2>
                        <p className="text-muted-foreground">Manage ingresses and view network topology.</p>
                    </div>
                    {activeTab === 'ingresses' && (
                        <button
                            onClick={() => {
                                setYaml('apiVersion: networking.k8s.io/v1\nkind: Ingress\nmetadata:\n  name: my-ingress\nspec:\n  rules:\n  - host: example.com\n    http:\n      paths:\n      - path: /\n        pathType: Prefix\n        backend:\n          service:\n            name: my-service\n            port:\n              number: 80');
                                setSelectedIngress(null);
                                setIsYamlOpen(true);
                            }}
                            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
                        >
                            Create Ingress
                        </button>
                    )}
                </div>

                <div className="flex space-x-1 rounded-lg bg-muted p-1 w-fit mb-4">
                    <button
                        onClick={() => setActiveTab('ingresses')}
                        className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                            activeTab === 'ingresses'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
                        }`}
                    >
                        <Edit className="h-4 w-4" />
                        Ingresses
                    </button>
                    <button
                        onClick={() => setActiveTab('topology')}
                        className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                            activeTab === 'topology'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
                        }`}
                    >
                        <Network className="h-4 w-4" />
                        Topology
                    </button>
                </div>
            </div>
            
            {activeTab === 'ingresses' ? (
                <>
                    <Table
                        data={processedIngresses}
                        columns={columns}
                        loading={loading}
                        error={error}
                    />

                    <YamlEditorModal
                        isOpen={isYamlOpen}
                        onClose={() => setIsYamlOpen(false)}
                        initialYaml={yaml}
                        onSave={fetchIngresses}
                        resourceType="Ingress"
                        resourceName={selectedIngress?.metadata.name}
                    />
                </>
            ) : (
                <div className="space-y-4">
                    {loading ? (
                        <div className="flex items-center justify-center p-8 text-muted-foreground">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            <span>Loading topology...</span>
                        </div>
                    ) : error ? (
                        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-4 text-destructive">
                            <AlertCircle className="h-5 w-5" />
                            <span>Error: {error}</span>
                        </div>
                    ) : (
                        <>
                            <div className="text-sm text-muted-foreground mb-4">
                                Network topology in namespace <span className="font-mono">{namespace}</span>
                            </div>
                            <TopologyTree ingresses={ingresses} services={services} pods={pods} deployments={deployments} />
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

const TopologyTree: React.FC<{ ingresses: Ingress[], services: any[], pods: any[], deployments?: any[] }> = ({ ingresses, services, pods, deployments = [] }) => {
    const buildTree = () => {
        const tree: string[] = [];

        // Group services by their ingresses
        const serviceToIngresses: { [key: string]: string[] } = {};
        ingresses.forEach(ing => {
            ing.spec?.rules?.forEach(rule => {
                rule.http?.paths?.forEach(path => {
                    const svcName = path.backend?.service?.name;
                    if (svcName) {
                        if (!serviceToIngresses[svcName]) serviceToIngresses[svcName] = [];
                        if (!serviceToIngresses[svcName].includes(ing.metadata.name)) {
                            serviceToIngresses[svcName].push(ing.metadata.name);
                        }
                    }
                });
            });
        });

        // Group deployments and pods by services
        const serviceToDeployments: { [key: string]: string[] } = {};
        const deploymentToPods: { [key: string]: string[] } = {};
        const serviceToPods: { [key: string]: string[] } = {}; // fallback

        services.forEach(svc => {
            if (svc.spec?.selector) {
                const selector = svc.spec.selector;
                deployments.forEach(dep => {
                    const matches = Object.entries(selector).every(([key, value]) => dep.spec?.template?.metadata?.labels?.[key] === value);
                    if (matches) {
                        if (!serviceToDeployments[svc.metadata.name]) serviceToDeployments[svc.metadata.name] = [];
                        serviceToDeployments[svc.metadata.name].push(dep.metadata.name);
                    }
                });
                pods.forEach(pod => {
                    const matches = Object.entries(selector).every(([key, value]) => pod.metadata?.labels?.[key] === value);
                    if (matches) {
                        if (serviceToDeployments[svc.metadata.name]?.length) {
                            // If has deployments, group under deployments
                        } else {
                            if (!serviceToPods[svc.metadata.name]) serviceToPods[svc.metadata.name] = [];
                            serviceToPods[svc.metadata.name].push(pod.metadata.name);
                        }
                    }
                });
            }
        });

        // Pods under deployments
        deployments.forEach(dep => {
            pods.forEach(pod => {
                const podLabels = pod.metadata?.labels || {};
                const depLabels = dep.spec?.template?.metadata?.labels || {};
                const matches = Object.entries(depLabels).every(([key, value]) => podLabels[key] === value);
                if (matches) {
                    if (!deploymentToPods[dep.metadata.name]) deploymentToPods[dep.metadata.name] = [];
                    deploymentToPods[dep.metadata.name].push(pod.metadata.name);
                }
            });
        });

        // Build the tree
        const processedServices = new Set<string>();

        ingresses.forEach(ing => {
            tree.push(`📥 ${ing.metadata.name} (Ingress)`);
            const connectedServices = new Set<string>();
            ing.spec?.rules?.forEach(rule => {
                rule.http?.paths?.forEach(path => {
                    const svcName = path.backend?.service?.name;
                    if (svcName && services.find(s => s.metadata.name === svcName)) {
                        connectedServices.add(svcName);
                    }
                });
            });
            Array.from(connectedServices).forEach(svcName => {
                if (!processedServices.has(svcName)) {
                    tree.push(`  └─ 🚀 ${svcName} (Service)`);
                    processedServices.add(svcName);

                    // Deployments
                    const deps = serviceToDeployments[svcName] || [];
                    deps.forEach(dep => {
                        tree.push(`    └─ 📦 ${dep} (Deployment)`);
                        const podsUnderDep = deploymentToPods[dep] || [];
                        podsUnderDep.forEach(pod => {
                            tree.push(`      └─ 🐳 ${pod} (Pod)`);
                        });
                    });

                    // Direct pods
                    const directPods = serviceToPods[svcName] || [];
                    directPods.forEach(pod => {
                        tree.push(`    └─ 🐳 ${pod} (Pod)`);
                    });
                }
            });
        });

        // Services without ingresses
        services.forEach(svc => {
            if (!processedServices.has(svc.metadata.name)) {
                tree.push(`🚀 ${svc.metadata.name} (Service)`);
                const deps = serviceToDeployments[svc.metadata.name] || [];
                deps.forEach(dep => {
                    tree.push(`  └─ 📦 ${dep} (Deployment)`);
                    const podsUnderDep = deploymentToPods[dep] || [];
                    podsUnderDep.forEach(pod => {
                        tree.push(`    └─ 🐳 ${pod} (Pod)`);
                    });
                });
                const directPods = serviceToPods[svc.metadata.name] || [];
                directPods.forEach(pod => {
                    tree.push(`  └─ 🐳 ${pod} (Pod)`);
                });
            }
        });

        return tree;
    };

    const treeLines = buildTree();

    return (
        <div className="border rounded-lg p-4 bg-card overflow-auto max-h-96">
            <div className="font-mono text-sm space-y-1">
                {treeLines.map((line, i) => (
                    <div key={i} className="whitespace-pre">{line}</div>
                ))}
                {treeLines.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                        No connections found in this namespace.
                    </div>
                )}
            </div>
        </div>
    );
};

export default IngressesView;
