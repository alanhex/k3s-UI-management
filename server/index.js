import express from 'express';
import cors from 'cors';
import * as k8s from '@kubernetes/client-node';
import { exec, spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const app = express();
const port = 3001;

// --- Kubernetes Configuration ---
const kc = new k8s.KubeConfig();
// Load config from default path (~/.kube/config).
// This is critical for connecting to the local k3s cluster.
try {
    kc.loadFromDefault();
} catch (error) {
    console.error("Failed to load KubeConfig. Ensure your cluster is running and ~/.kube/config is valid.");
    console.error(error.message);
    process.exit(1);
}

// --- Kubernetes API Clients with TLS Workaround ---
// Setup the base options to disable strict SSL checking, which is necessary for k3s/k3d self-signed certificates.
const baseOptions = {
    rejectUnauthorized: false
};

const k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api, baseOptions);
const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api, baseOptions);
const k8sNetworkingApi = kc.makeApiClient(k8s.NetworkingV1Api, baseOptions);
const k8sRbacApi = kc.makeApiClient(k8s.RbacAuthorizationV1Api, baseOptions);
const k8sStorageApi = kc.makeApiClient(k8s.StorageV1Api, baseOptions);

// --- Allowed commands whitelist for kubectl endpoint ---
// Only these subcommands are permitted to reduce attack surface
const ALLOWED_KUBECTL_COMMANDS = new Set([
    'get', 'describe', 'logs', 'exec', 'port-forward', 'cp',
    'apply', 'create', 'delete', 'edit', 'label', 'annotate',
    'scale', 'rollout', 'top', 'api-resources', 'api-versions',
    'cluster-info', 'config', 'explain', 'version'
]);

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Request Logging Middleware ---
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
});

// --- Structured Error Handling ---
class ApiError extends Error {
    constructor(statusCode, message, details = null) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
        this.name = 'ApiError';
    }
}

const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
            error: err.message,
            details: err.details
        });
    }

    // Handle Kubernetes errors
    if (err.response && err.response.body) {
        return res.status(500).json({
            error: 'Kubernetes API error',
            details: err.response.body.message || err.message
        });
    }

    res.status(500).json({
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
};

// --- Input Validation Helpers ---
const validateNamespace = (namespace) => {
    // Kubernetes namespace naming rules: lowercase alphanumeric or '-', max 63 chars
    const namespaceRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
    if (namespace && typeof namespace === 'string') {
        if (namespace.length > 63 || !namespaceRegex.test(namespace)) {
            throw new ApiError(400, 'Invalid namespace name');
        }
    }
    return namespace || 'default';
};

const validateResourceName = (name) => {
    // DNS subdomain naming rules
    const nameRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;
    if (name && typeof name === 'string') {
        if (name.length > 253 || !nameRegex.test(name)) {
            throw new ApiError(400, 'Invalid resource name');
        }
    }
    return name;
};

const validateReplicas = (replicas) => {
    const num = parseInt(replicas, 10);
    if (isNaN(num) || num < 0 || num > 10000) {
        throw new ApiError(400, 'Invalid replica count (must be 0-10000)');
    }
    return num;
};

const sanitizeCommand = (command) => {
    // Remove any shell metacharacters that could be used for injection
    return command.replace(/[;&|`$(){}[\]\\!#*?"'< >\n\r]/g, '').trim();
};

const validateKubectlCommand = (kubectlCommand) => {
    // Extract the subcommand (first word after kubectl)
    const match = kubectlCommand.match(/^(\w+)/);
    if (!match) {
        throw new ApiError(400, 'Invalid kubectl command');
    }

    const subcommand = match[1];
    if (!ALLOWED_KUBECTL_COMMANDS.has(subcommand)) {
        throw new ApiError(403, `kubectl subcommand '${subcommand}' is not allowed`);
    }

    // Additional restrictions for dangerous operations
    if (subcommand === 'delete' && !kubectlCommand.includes('--dry-run')) {
        // Allow delete but log it
        console.warn(`[SECURITY] Delete command executed: ${kubectlCommand}`);
    }

    return sanitizeCommand(kubectlCommand);
};

// --- Helper Functions ---

/**
 * Executes a kubectl command using child_process.exec.
 * NOTE: This relies on 'kubectl' being available in the server's environment path.
 * Only used for commands that cannot be performed via Kubernetes API client.
 * @param {string} command - The kubectl command to execute (e.g., 'get pods -A')
 * @returns {Promise<string>} - The stdout of the command
 */
function executeKubectl(command) {
    const fullCommand = `kubectl ${command}`;
    console.log(`Executing: ${fullCommand}`);

    return new Promise((resolve, reject) => {
        exec(fullCommand, (error, stdout, stderr) => {
            if (error) {
                return reject(new Error(stderr.trim() || error.message));
            }
            if (stderr) {
                 console.warn(`kubectl stderr (warning/info): ${stderr.trim()}`);
            }
            resolve(stdout.trim());
        });
    });
}

/**
 * Executes a kubectl command with input (stdin) using child_process.spawn.
 * Useful for 'apply -f -'
 * @param {string[]} args - Array of arguments for kubectl
 * @param {string} input - The input string to write to stdin
 * @returns {Promise<string>}
 */
function executeKubectlWithStdin(args, input) {
    return new Promise((resolve, reject) => {
        const kubectl = spawn('kubectl', args);
        let stdout = '';
        let stderr = '';

        kubectl.stdout.on('data', (data) => {
            stdout += data;
        });

        kubectl.stderr.on('data', (data) => {
            stderr += data;
        });

        kubectl.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(stderr.trim() || `Command failed with code ${code}`));
            } else {
                resolve(stdout.trim());
            }
        });

        kubectl.stdin.write(input);
        kubectl.stdin.end();
    });
}

/**
 * Executes a k3d command using child_process.exec.
 * Tries system path first, then user local path.
 * @param {string} command - The k3d command to execute (e.g., 'cluster create mycluster')
 * @returns {Promise<string>} - The stdout of the command
 */
function executeK3d(command) {
    const systemCommand = `k3d ${command}`;

    console.log(`Executing k3d command: ${systemCommand}`);
    console.log(`Current PATH: ${process.env.PATH}`);

    return new Promise((resolve, reject) => {
        // Try system path first
        exec(systemCommand, (error, stdout, stderr) => {
            if (error) {
                console.error(`System path failed for k3d ${command}:`, error.message);
                console.error(`stderr: ${stderr}`);
                // Return the system path error directly since user path is not needed
                return reject(new Error(stderr.trim() || error.message));
            }
            if (stderr) {
                 // Even with no error, sometimes k3d prints info to stderr
                 console.warn(`k3d stderr (warning/info): ${stderr.trim()}`);
            }
            console.log(`k3d command succeeded: ${stdout.trim()}`);
            resolve(stdout.trim());
        });
    });
}


// --- API Endpoints: Visualization ---

// Get Namespaces - using K8s API client instead of exec
app.get('/api/namespaces', async (req, res, next) => {
    try {
        const response = await k8sCoreApi.listNamespace();
        res.json(response.body.items);
    } catch (error) {
        next(error);
    }
});

// --- Storage Endpoints ---

// Get PersistentVolumes - using K8s API client
app.get('/api/persistentvolumes', async (req, res, next) => {
    try {
        const response = await k8sCoreApi.listPersistentVolume();
        res.json(response.body.items);
    } catch (error) {
        next(error);
    }
});

// Get PersistentVolumeClaims - using K8s API client with validation
app.get('/api/persistentvolumeclaims', async (req, res, next) => {
    try {
        const namespace = validateNamespace(req.query.namespace);
        const response = await k8sCoreApi.readNamespacedPersistentVolumeClaimCollection(namespace);
        res.json(response.body.items);
    } catch (error) {
        next(error);
    }
});

// Get StorageClasses - using K8s API client
app.get('/api/storageclasses', async (req, res, next) => {
    try {
        const response = await k8sStorageApi.listStorageClass();
        res.json(response.body.items);
    } catch (error) {
        next(error);
    }
});

// Search Artifact Hub for Helm charts
app.get('/api/helm/search', async (req, res, next) => {
    const { query } = req.query;
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return next(new ApiError(400, 'Search query is required'));
    }

    try {
        const artifactHubUrl = `https://artifacthub.io/api/v1/packages/search?kind=0&ts_query=${encodeURIComponent(query.trim())}`;
        const response = await fetch(artifactHubUrl);

        if (!response.ok) {
            throw new ApiError(response.status, `Artifact Hub API failed`);
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        if (error instanceof ApiError) next(error);
        else next(new ApiError(500, 'Failed to search Helm charts', error.message));
    }
});

// Install Helm chart with validation
app.post('/api/helm/install', async (req, res, next) => {
    const { chart, repo, version, releaseName, namespace, valuesYaml } = req.body;

    if (!chart || !repo || !releaseName || !namespace) {
        return next(new ApiError(400, 'Chart, repo, releaseName, and namespace are required'));
    }

    // Validate inputs
    const validNamespace = validateNamespace(namespace);
    const validReleaseName = validateResourceName(releaseName);

    try {
        let command = `helm install ${validReleaseName} ${chart}`;
        if (repo) command += ` --repo ${repo}`;
        if (version) command += ` --version ${version}`;
        command += ` --namespace ${validNamespace}`;

        let tempFile = null;
        if (valuesYaml) {
            tempFile = path.join(os.tmpdir(), `helm-values-${Date.now()}.yaml`);
            fs.writeFileSync(tempFile, valuesYaml);
            command += ` --values ${tempFile}`;
        }
        command += ` --create-namespace`;

        console.log(`Executing: helm install`);
        const result = await new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(stderr.trim() || error.message));
                } else {
                    resolve(stdout.trim());
                }
            });
        });

        res.json({ success: true, output: result });
    } catch (error) {
        next(new ApiError(500, 'Failed to install Helm chart', error.message));
    } finally {
        // Cleanup temp file
        if (tempFile && fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
        }
    }
});

// --- Access Control Endpoints (RBAC) ---

// Get ServiceAccounts - using K8s API client with validation
app.get('/api/serviceaccounts', async (req, res, next) => {
    try {
        const namespace = validateNamespace(req.query.namespace);
        const response = await k8sCoreApi.readNamespacedServiceAccountList(namespace);
        res.json(response.body.items);
    } catch (error) {
        next(error);
    }
});

// Get Roles - using K8s API client with validation
app.get('/api/roles', async (req, res, next) => {
    try {
        const namespace = validateNamespace(req.query.namespace);
        const response = await k8sRbacApi.readNamespacedRoleList(namespace);
        res.json(response.body.items);
    } catch (error) {
        next(error);
    }
});

// Get ClusterRoles - using K8s API client
app.get('/api/clusterroles', async (req, res, next) => {
    try {
        const response = await k8sRbacApi.readClusterRoleList();
        res.json(response.body.items);
    } catch (error) {
        next(error);
    }
});

// Get RoleBindings - using K8s API client with validation
app.get('/api/rolebindings', async (req, res, next) => {
    try {
        const namespace = validateNamespace(req.query.namespace);
        const response = await k8sRbacApi.readNamespacedRoleBindingList(namespace);
        res.json(response.body.items);
    } catch (error) {
        next(error);
    }
});

// --- Helm Management (k3s CRDs) ---

// Get HelmCharts - using exec since these are CRDs
app.get('/api/helmcharts', async (req, res, next) => {
    try {
        const namespace = validateNamespace(req.query.namespace);
        const output = await executeKubectl(`get helmcharts.helm.cattle.io -n ${namespace} -o json`);
        const data = JSON.parse(output);
        res.json(data.items);
    } catch (error) {
        // If CRD doesn't exist (not k3s?), return empty list gracefully
        if (error.message.includes("the server doesn't have a resource type")) {
            return res.json([]);
        }
        next(error);
    }
});

// Get HelmChartConfigs - using exec since these are CRDs
app.get('/api/helmchartconfigs', async (req, res, next) => {
    try {
        const namespace = validateNamespace(req.query.namespace);
        const output = await executeKubectl(`get helmchartconfigs.helm.cattle.io -n ${namespace} -o json`);
        const data = JSON.parse(output);
        res.json(data.items);
    } catch (error) {
        if (error.message.includes("the server doesn't have a resource type")) {
            return res.json([]);
        }
        next(error);
    }
});

// --- Configuration Endpoints ---

// Get ConfigMaps - using K8s API client with validation
app.get('/api/configmaps', async (req, res, next) => {
    try {
        const namespace = validateNamespace(req.query.namespace);
        const response = await k8sCoreApi.readNamespacedConfigMapList(namespace);
        res.json(response.body.items);
    } catch (error) {
        next(error);
    }
});

// Get Secrets - using K8s API client with validation
app.get('/api/secrets', async (req, res, next) => {
    try {
        const namespace = validateNamespace(req.query.namespace);
        const response = await k8sCoreApi.readNamespacedSecretList(namespace);
        res.json(response.body.items);
    } catch (error) {
        next(error);
    }
});

// --- Network Endpoints ---

// Get Ingresses - using K8s API client with validation
app.get('/api/ingresses', async (req, res, next) => {
    try {
        const namespace = validateNamespace(req.query.namespace);
        const isAllNamespaces = namespace === 'all';

        if (isAllNamespaces) {
            const response = await k8sNetworkingApi.listIngressForAllNamespaces();
            res.json(response.body.items);
        } else {
            const response = await k8sNetworkingApi.readNamespacedIngressList(namespace);
            res.json(response.body.items);
        }
    } catch (error) {
        next(error);
    }
});

// Get Nodes - using K8s API client
app.get('/api/nodes', async (req, res, next) => {
    try {
        const response = await k8sCoreApi.listNode();
        res.json(response.body.items);
    } catch (error) {
        next(error);
    }
});

// Get Pods - using K8s API client with validation
app.get('/api/pods', async (req, res, next) => {
    try {
        const namespace = validateNamespace(req.query.namespace);
        const isAllNamespaces = namespace === 'all';

        if (isAllNamespaces) {
            const response = await k8sCoreApi.listPodForAllNamespaces();
            res.json(response.body.items);
        } else {
            const response = await k8sCoreApi.readNamespacedPodList(namespace);
            res.json(response.body.items);
        }
    } catch (error) {
        next(error);
    }
});

// Get Deployments - using K8s API client with validation
app.get('/api/deployments', async (req, res, next) => {
    try {
        const namespace = validateNamespace(req.query.namespace);
        const isAllNamespaces = namespace === 'all';

        if (isAllNamespaces) {
            const response = await k8sAppsApi.listDeploymentForAllNamespaces();
            res.json(response.body.items);
        } else {
            const response = await k8sAppsApi.readNamespacedDeploymentList(namespace);
            res.json(response.body.items);
        }
    } catch (error) {
        next(error);
    }
});

// Get Services - using K8s API client with validation
app.get('/api/services', async (req, res, next) => {
    try {
        const namespace = validateNamespace(req.query.namespace);
        const isAllNamespaces = namespace === 'all';

        if (isAllNamespaces) {
            const response = await k8sCoreApi.listServiceForAllNamespaces();
            res.json(response.body.items);
        } else {
            const response = await k8sCoreApi.readNamespacedServiceList(namespace);
            res.json(response.body.items);
        }
    } catch (error) {
        next(error);
    }
});

// Get DaemonSets - using K8s API client with validation
app.get('/api/daemonsets', async (req, res, next) => {
    try {
        const namespace = validateNamespace(req.query.namespace);
        const response = await k8sAppsApi.readNamespacedDaemonSetList(namespace);
        res.json(response.body.items);
    } catch (error) {
        next(error);
    }
});

// Get ReplicaSets - using K8s API client with validation
app.get('/api/replicasets', async (req, res, next) => {
    try {
        const namespace = validateNamespace(req.query.namespace);
        const response = await k8sAppsApi.readNamespacedReplicaSetList(namespace);
        res.json(response.body.items);
    } catch (error) {
        next(error);
    }
});

// --- Generic Resource Management Endpoints ---

// Get Resource YAML
app.get('/api/resources/:type/:name/yaml', async (req, res, next) => {
    try {
        const { type, name } = req.params;
        const namespace = validateNamespace(req.query.namespace);

        // Validate resource type
        const allowedTypes = ['pod', 'service', 'deployment', 'configmap', 'secret', 'ingress', 'daemonset', 'replicaset', 'statefulset', 'job', 'cronjob'];
        if (!allowedTypes.includes(type.toLowerCase())) {
            return next(new ApiError(400, `Resource type '${type}' is not allowed`));
        }

        const validName = validateResourceName(name);
        const output = await executeKubectl(`get ${type} ${validName} -n ${namespace} -o yaml`);
        res.json({ yaml: output });
    } catch (error) {
        next(error);
    }
});

// Apply Resource (Create/Update) via YAML with validation
app.post('/api/resources/apply', async (req, res, next) => {
    const { yaml } = req.body;
    if (!yaml || typeof yaml !== 'string') {
        return next(new ApiError(400, 'YAML content is required'));
    }

    // Basic YAML validation - check for dangerous operations
    const dangerousPatterns = [
        /--with-fields=/,  // Field injection
        /--dry-run=client/, // Client-side dry run
    ];

    for (const pattern of dangerousPatterns) {
        if (pattern.test(yaml)) {
            return next(new ApiError(400, 'YAML contains disallowed patterns'));
        }
    }

    try {
        const output = await executeKubectlWithStdin(['apply', '-f', '-'], yaml);
        res.json({ message: 'Resource applied successfully', output });
    } catch (error) {
        next(new ApiError(500, 'Failed to apply resource', error.message));
    }
});

// Delete Resource with validation
app.delete('/api/resources/:type/:name', async (req, res, next) => {
    try {
        const { type, name } = req.params;
        const namespace = validateNamespace(req.query.namespace);

        // Validate resource type
        const allowedTypes = ['pod', 'service', 'deployment', 'configmap', 'secret', 'ingress', 'daemonset', 'replicaset', 'statefulset', 'job', 'cronjob'];
        if (!allowedTypes.includes(type.toLowerCase())) {
            return next(new ApiError(400, `Resource type '${type}' is not allowed`));
        }

        const validName = validateResourceName(name);
        await executeKubectl(`delete ${type} ${validName} -n ${namespace}`);
        res.json({ message: `${type} ${validName} deleted successfully` });
    } catch (error) {
        next(error);
    }
});

// Scale Resource with validation
app.post('/api/resources/:type/:name/scale', async (req, res, next) => {
    try {
        const { type, name } = req.params;
        const namespace = validateNamespace(req.query.namespace);
        const { replicas } = req.body;

        // Validate resource type (only scalable types)
        const scalableTypes = ['deployment', 'replicaset', 'statefulset'];
        if (!scalableTypes.includes(type.toLowerCase())) {
            return next(new ApiError(400, `Resource type '${type}' cannot be scaled`));
        }

        const validName = validateResourceName(name);
        const validReplicas = validateReplicas(replicas);
        await executeKubectl(`scale ${type} ${validName} --replicas=${validReplicas} -n ${namespace}`);
        res.json({ message: `${type} ${validName} scaled to ${validReplicas} replicas` });
    } catch (error) {
        next(error);
    }
});

// --- API Endpoint: Kubectl Execution with Security Enhancements ---

app.post('/api/kubectl', async (req, res, next) => {
    const { command } = req.body;

    if (!command || typeof command !== 'string' || command.trim() === '') {
        return next(new ApiError(400, 'Command is required'));
    }

    const trimmedCommand = command.trim();
    if (!trimmedCommand.startsWith('kubectl ')) {
        return next(new ApiError(400, 'Command must start with "kubectl"', { example: 'kubectl get pods' }));
    }

    const kubectlCommand = trimmedCommand.substring(8).trim();

    // Validate against whitelist and sanitize
    const validatedCommand = validateKubectlCommand(kubectlCommand);

    try {
        const output = await executeKubectl(validatedCommand);
        res.json({ output });
    } catch (error) {
        next(new ApiError(500, 'Kubectl command failed', error.message));
    }
});

// --- API Endpoints: Cluster Management (k3d) ---

// List k3d clusters
app.get('/api/clusters', async (req, res, next) => {
    try {
        const output = await executeK3d('cluster list --output json');
        const clusters = JSON.parse(output || '[]');
        const processedClusters = clusters.map(cluster => {
            let oldestCreated = new Date().toISOString();
            if (cluster.nodes && cluster.nodes.length > 0) {
                oldestCreated = cluster.nodes.reduce((minDate, node) => {
                    const nodeDate = new Date(node.created).toISOString();
                    return nodeDate < minDate ? nodeDate : minDate;
                }, oldestCreated);
            }
            return {
                ...cluster,
                created: oldestCreated
            };
        });
        res.json(processedClusters);
    } catch (error) {
        // Check if the error is related to Docker not running
        const errorMessage = error.message;
        if (errorMessage.includes('Cannot connect to the Docker daemon') ||
            errorMessage.includes('docker daemon running')) {
            next(new ApiError(503, 'Docker daemon is not running', 'k3d requires Docker to be running. Please start Docker Desktop or the Docker daemon.'));
        } else {
            next(new ApiError(500, 'Failed to list clusters', errorMessage));
        }
    }
});

// Create a new k3d cluster with validation
app.post('/api/clusters', async (req, res, next) => {
    const { name, options } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return next(new ApiError(400, 'Cluster name is required'));
    }

    const clusterName = validateResourceName(name.trim());
    let command = `cluster create ${clusterName}`;

    // Add additional options if provided with validation
    if (options && typeof options === 'object') {
        if (options.agents) command += ` --agents ${parseInt(options.agents, 10) || 1}`;
        if (options.servers) command += ` --servers ${parseInt(options.servers, 10) || 1}`;
        if (options.k3sVersion) command += ` --image rancher/k3s:${options.k3sVersion}`;
        if (options.port) command += ` --port ${parseInt(options.port, 10) || 6443}`;
    }

    try {
        const output = await executeK3d(command);
        res.json({ message: 'Cluster created successfully', output });
    } catch (error) {
        const errorMessage = error.message;
        if (errorMessage.includes('Cannot connect to the Docker daemon') ||
            errorMessage.includes('docker daemon running')) {
            next(new ApiError(503, 'Docker daemon is not running', 'k3d requires Docker to be running. Please start Docker Desktop or the Docker daemon.'));
        } else {
            next(new ApiError(500, 'Failed to create cluster', errorMessage));
        }
    }
});

// Delete a k3d cluster with validation
app.delete('/api/clusters/:name', async (req, res, next) => {
    try {
        const name = req.params.name;
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return next(new ApiError(400, 'Cluster name is required'));
        }

        const clusterName = validateResourceName(name.trim());
        const output = await executeK3d(`cluster delete ${clusterName}`);
        res.json({ message: 'Cluster deleted successfully', output });
    } catch (error) {
        const errorMessage = error.message;
        if (errorMessage.includes('Cannot connect to the Docker daemon') ||
            errorMessage.includes('docker daemon running')) {
            next(new ApiError(503, 'Docker daemon is not running', 'k3d requires Docker to be running. Please start Docker Desktop or the Docker daemon.'));
        } else {
            next(new ApiError(500, 'Failed to delete cluster', errorMessage));
        }
    }
});

// Get cluster info/details
app.get('/api/clusters/:name', async (req, res, next) => {
    try {
        const name = req.params.name;
        if (!name) {
            return next(new ApiError(400, 'Cluster name is required'));
        }

        const clusterName = validateResourceName(name.trim());
        const output = await executeK3d(`cluster list ${clusterName} --output json`);
        const clusters = JSON.parse(output || '[]');
        const cluster = clusters.find(c => c.name === clusterName);

        if (!cluster) {
            return next(new ApiError(404, 'Cluster not found'));
        }

        res.json(cluster);
    } catch (error) {
        next(new ApiError(500, 'Failed to get cluster info', error.message));
    }
});

// Switch kubectl context to a specific cluster with validation
app.post('/api/clusters/:name/switch', async (req, res, next) => {
    try {
        const name = req.params.name;
        if (!name) {
            return next(new ApiError(400, 'Cluster name is required'));
        }

        const clusterName = validateResourceName(name.trim());
        const output = await executeK3d(`kubeconfig merge ${clusterName} --kubeconfig-switch-context`);
        res.json({ message: 'Switched kubectl context successfully', output });
    } catch (error) {
        next(new ApiError(500, 'Failed to switch context', error.message));
    }
});

// Check if k3d is installed
app.get('/api/k3d/status', async (req, res, next) => {
    try {
        await executeK3d('cluster list --output json');
        res.json({ installed: true, version: 'installed' });
    } catch (error) {
        const errorMessage = error.message;
        if (errorMessage.includes('Cannot connect to the Docker daemon') ||
            errorMessage.includes('docker daemon running')) {
            res.json({ installed: false, error: 'Docker daemon is not running' });
        } else if (errorMessage.includes('k3d: command not found') || errorMessage.includes('no such file')) {
            res.json({ installed: false, error: 'k3d is not installed' });
        } else {
            res.json({ installed: false, error: errorMessage });
        }
    }
});

// Get cluster version info
app.get('/api/cluster/version', async (req, res, next) => {
    try {
        const k8sVersion = await executeKubectl('version');
        const k3dVersion = await new Promise((resolve, reject) => {
            exec('k3d version', (error, stdout) => {
                if (error) resolve('Not available');
                else resolve(stdout.trim().split('\n')[0]);
            });
        });
        res.json({ k8s: k8sVersion.trim(), k3d: k3dVersion });
    } catch (error) {
        next(new ApiError(500, 'Failed to get version info'));
    }
});

// Get recent cluster events
app.get('/api/events', async (req, res, next) => {
    try {
        const output = await executeKubectl('get events --all-namespaces --sort-by=.lastTimestamp -o json');
        const events = JSON.parse(output);
        res.json(events.items.slice(-10));
    } catch (error) {
        next(error);
    }
});



// --- Server Startup ---
// Apply error handler at the end
app.use(errorHandler);

app.listen(port, () => {
    console.log(`K3s UI Management Backend listening on port ${port}`);
    console.log('API documentation:');
    console.log(`- Nodes: http://localhost:${port}/api/nodes`);
    console.log(`- Kubectl: POST http://localhost:${port}/api/kubectl`);
    console.log(`- Clusters: http://localhost:${port}/api/clusters`);
    console.log(`- k3d Status: http://localhost:${port}/api/k3d/status`);
});

export default app;
