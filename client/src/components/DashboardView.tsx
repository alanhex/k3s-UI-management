import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Activity, Server, Network, Package, Zap } from 'lucide-react';

const DashboardView: React.FC = () => {
    const [stats, setStats] = useState({
        pods: 0,
        services: 0,
        ingresses: 0,
        deployments: 0,
        nodes: 0
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [details, setDetails] = useState<{ [key: string]: any[] }>({});
    const [detailsLoading, setDetailsLoading] = useState<{ [key: string]: boolean }>({});
    const [clusterInfo, setClusterInfo] = useState<{ k8s: string; k3d: string } | null>(null);
    const [recentEvents, setRecentEvents] = useState<any[]>([]);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            setLoading(true);
            setDetailsLoading({ pods: true, services: true, ingresses: true, deployments: true, nodes: true });

            const [podsRes, servicesRes, ingressesRes, deploymentsRes, nodesRes, versionRes, eventsRes] = await Promise.all([
                axios.get('/api/pods?namespace=all'),
                axios.get('/api/services?namespace=all'),
                axios.get('/api/ingresses?namespace=all'),
                axios.get('/api/deployments?namespace=all'),
                axios.get('/api/nodes'),
                axios.get('/api/cluster/version'),
                axios.get('/api/events')
            ]);

            setStats({
                pods: podsRes.data.length,
                services: servicesRes.data.length,
                ingresses: ingressesRes.data.length,
                deployments: deploymentsRes.data.length,
                nodes: nodesRes.data.length
            });
            setDetails({
                pods: podsRes.data,
                services: servicesRes.data,
                ingresses: ingressesRes.data,
                deployments: deploymentsRes.data,
                nodes: nodesRes.data
            });
            setClusterInfo(versionRes.data);
            setRecentEvents(eventsRes.data.reverse()); // Show newest first

        } catch (err: any) {
            setError(axios.isAxiosError(err) ? err.message : 'Failed to fetch cluster stats');
        } finally {
            setLoading(false);
            setDetailsLoading({ pods: false, services: false, ingresses: false, deployments: false, nodes: false });
        }
    };

    const widgets = [
        { title: 'Pods', value: stats.pods, icon: Package, color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-950' },
        { title: 'Services', value: stats.services, icon: Network, color: 'text-green-600', bgColor: 'bg-green-50 dark:bg-green-950' },
        { title: 'Ingresses', value: stats.ingresses, icon: Activity, color: 'text-purple-600', bgColor: 'bg-purple-50 dark:bg-purple-950' },
        { title: 'Deployments', value: stats.deployments, icon: Zap, color: 'text-orange-600', bgColor: 'bg-orange-50 dark:bg-orange-950' },
        { title: 'Nodes', value: stats.nodes, icon: Server, color: 'text-red-600', bgColor: 'bg-red-50 dark:bg-red-950' }
    ];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Cluster Dashboard</h2>
                    <p className="text-muted-foreground">Overview of your current kubectl context resources</p>
                    <p className="text-xs text-muted-foreground mt-1">Make sure kubectl is configured for your k3d cluster</p>
                </div>
                <button
                    onClick={fetchStats}
                    className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
                    disabled={loading}
                >
                    {loading ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>

            {error && (
                <div className="rounded-md bg-destructive/10 p-4 text-destructive">
                    Error: {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                {widgets.map((widget) => {
                    const type = widget.title.toLowerCase();
                    const route = type === 'nodes' ? '/nodes' :
                                  type === 'ingresses' ? '/ingresses' :
                                  `/${type}`;
                    const items = details[type] || [];
                    return (
                        <div key={widget.title}>
                            {/* Widget Card (Clickable Link) */}
                            <Link to={route} className="block">
                                <div className={`rounded-lg border p-6 cursor-pointer hover:shadow-lg transition-shadow ${widget.bgColor}`}>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">{widget.title}</p>
                                            <p className={`text-3xl font-bold ${widget.color}`}>{loading ? '...' : widget.value}</p>
                                        </div>
                                        <widget.icon className={`h-8 w-8 ${widget.color}`} />
                                    </div>
                                </div>
                            </Link>

                            {/* Widget Details (Expanded by default) */}
                            <div className="mt-2 rounded-lg border bg-card p-4 max-h-96 overflow-y-auto">
                                {detailsLoading[type] ? (
                                    <p className="text-sm text-muted-foreground">Loading...</p>
                                ) : items.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No {type} found</p>
                                ) : (
                                    <div className="space-y-2">
                                        {items.map((item, i) => {
                                            let statusText = '';
                                            let statusClass = '';

                                            if (type === 'pods') {
                                                statusText = item.status?.phase || 'Unknown';
                                                statusClass = item.status?.phase === 'Running' ? 'bg-green-100 text-green-800' :
                                                             item.status?.phase === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                                                             'bg-red-100 text-red-800';
                                            } else if (type === 'services') {
                                                statusText = item.spec?.type || 'ClusterIP';
                                                statusClass = 'bg-blue-100 text-blue-800';
                                            } else if (type === 'ingresses') {
                                                const addresses = item.status?.loadBalancer?.ingress?.map((ing: any) => ing.ip || ing.hostname).join(', ') || 'Pending';
                                                statusText = addresses;
                                                statusClass = addresses === 'Pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800';
                                            } else if (type === 'deployments') {
                                                const replicas = item.status?.readyReplicas || 0;
                                                const desired = item.spec?.replicas || 0;
                                                statusText = `${replicas}/${desired} ready`;
                                                statusClass = replicas === desired ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
                                            } else if (type === 'nodes') {
                                                const conditions = item.status?.conditions || [];
                                                const readyCondition = conditions.find((c: any) => c.type === 'Ready');
                                                statusText = readyCondition?.status === 'True' ? 'Ready' : 'Not Ready';
                                                statusClass = readyCondition?.status === 'True' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
                                            }

                                            return (
                                                <div key={i} className="text-sm p-2 bg-muted rounded">
                                                    <span className="font-medium">{item.metadata?.name}</span>
                                                    {item.metadata?.namespace && (
                                                        <span className="text-muted-foreground ml-2">({item.metadata.namespace})</span>
                                                    )}
                                                    <span className={`ml-2 px-2 py-1 rounded text-xs ${statusClass} max-w-32 truncate inline-block`}>
                                                        {statusText}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Recent Events */}
            <div className="rounded-lg border bg-card p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Recent Events
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                    {recentEvents.length > 0 ? (
                        recentEvents.map((event, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                                <div className="flex-1">
                                    <p className="text-sm font-medium">{event.message || event.reason}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {event.involvedObject?.kind}/{event.involvedObject?.name} in {event.metadata?.namespace}
                                    </p>
                                </div>
                                <span className={`px-2 py-1 rounded text-xs ${
                                    event.type === 'Warning' ? 'bg-yellow-100 text-yellow-800' :
                                    event.type === 'Normal' ? 'bg-green-100 text-green-800' :
                                    'bg-gray-100 text-gray-800'
                                }`}>
                                    {event.type}
                                </span>
                            </div>
                        ))
                    ) : (
                        <p className="text-muted-foreground">No recent events</p>
                    )}
                </div>
            </div>

            {/* Cluster Health */}
            <div className="rounded-lg border bg-card p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    Cluster Health
                </h3>
                {clusterInfo ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-muted rounded-lg">
                            <p className="text-sm text-muted-foreground">Kubernetes Version</p>
                            <p className="text-lg font-medium">{clusterInfo.k8s.split('\n')[0]}</p>
                        </div>
                        <div className="p-4 bg-muted rounded-lg">
                            <p className="text-sm text-muted-foreground">k3d Version</p>
                            <p className="text-lg font-medium">{clusterInfo.k3d}</p>
                        </div>
                    </div>
                ) : (
                    <p className="text-muted-foreground">Loading cluster info...</p>
                )}
            </div>

            {/* Quick Actions */}
            <div className="rounded-lg border bg-card p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Quick Actions
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <button
                        onClick={() => { alert('Not implemented'); }}
                        className="flex flex-col items-center justify-center p-4 rounded-md border hover:bg-muted transition-colors"
                    >
                        <Package className="h-6 w-6 mb-2" />
                        <span className="text-sm font-medium">Install Nginx</span>
                    </button>
                    <button
                        onClick={() => { alert('Not implemented'); }}
                        className="flex flex-col items-center justify-center p-4 rounded-md border hover:bg-muted transition-colors"
                    >
                        <Network className="h-6 w-6 mb-2" />
                        <span className="text-sm font-medium">Install Prometheus</span>
                    </button>
                    <Link to="/terminal" className="flex flex-col items-center justify-center p-4 rounded-md border hover:bg-muted transition-colors">
                        <Activity className="h-6 w-6 mb-2" />
                        <span className="text-sm font-medium">Terminal</span>
                    </Link>
                    <button
                        onClick={() => { alert('Not implemented'); }}
                        className="flex flex-col items-center justify-center p-4 rounded-md border hover:bg-muted transition-colors"
                    >
                        <Zap className="h-6 w-6 mb-2" />
                        <span className="text-sm font-medium">Cluster Ops</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DashboardView;
