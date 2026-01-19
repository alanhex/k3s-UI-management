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

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Helper Functions ---

/**
 * Executes a kubectl command using child_process.exec.
 * NOTE: This relies on 'kubectl' being available in the server's environment path.
 * @param {string} command - The kubectl command to execute (e.g., 'get pods -A')
 * @returns {Promise<string>} - The stdout of the command
 */
function executeKubectl(command) {
    const fullCommand = `kubectl ${command}`;
    console.log(`Executing: ${fullCommand}`);

    return new Promise((resolve, reject) => {
        exec(fullCommand, (error, stdout, stderr) => {
            if (error) {
                // Return stderr for better error reporting to the frontend
                return reject(new Error(stderr.trim() || error.message));
            }
            if (stderr) {
                 // Even with no error, sometimes kubectl prints warnings to stderr
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

// Get Namespaces
app.get('/api/namespaces', async (req, res) => {
    try {
        const output = await executeKubectl('get namespaces -o json');
        const data = JSON.parse(output);
        res.json(data.items);
    } catch (error) {
        console.error('Error fetching namespaces:', error);
        res.status(500).json({ error: 'Failed to fetch namespaces', details: error.message });
    }
});

// --- Storage Endpoints ---

// Get PersistentVolumes
app.get('/api/persistentvolumes', async (req, res) => {
    try {
        const output = await executeKubectl('get pv -o json');
        const data = JSON.parse(output);
        res.json(data.items);
    } catch (error) {
        console.error('Error fetching PVs:', error);
        res.status(500).json({ error: 'Failed to fetch PVs', details: error.message });
    }
});

// Get PersistentVolumeClaims
app.get('/api/persistentvolumeclaims', async (req, res) => {
    let namespace = 'default';
    if (req.query.namespace && typeof req.query.namespace === 'string') {
        namespace = req.query.namespace;
    }
    try {
        const output = await executeKubectl(`get pvc -n ${namespace} -o json`);
        const data = JSON.parse(output);
        res.json(data.items);
    } catch (error) {
        console.error(`Error fetching PVCs in namespace ${namespace}:`, error);
        res.status(500).json({ error: `Failed to fetch PVCs`, details: error.message });
    }
});

// Get StorageClasses
app.get('/api/storageclasses', async (req, res) => {
    try {
        const output = await executeKubectl('get sc -o json');
        const data = JSON.parse(output);
        res.json(data.items);
    } catch (error) {
        console.error('Error fetching StorageClasses:', error);
        res.status(500).json({ error: 'Failed to fetch StorageClasses', details: error.message });
    }
});

// Search Artifact Hub for Helm charts
app.get('/api/helm/search', async (req, res) => {
    const { query } = req.query;
    if (!query) {
        return res.status(400).json({ error: 'Search query is required' });
    }

    try {
        // kind=0 filters for Helm charts only
        const artifactHubUrl = `https://artifacthub.io/api/v1/packages/search?kind=0&ts_query=${encodeURIComponent(query)}`;
        const response = await fetch(artifactHubUrl);
        
        if (!response.ok) {
            throw new Error(`Artifact Hub API failed with status ${response.status}`);
        }
        
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Helm search error:', error);
        res.status(500).json({ error: 'Failed to search Helm charts' });
    }
});

// Install Helm chart
app.post('/api/helm/install', async (req, res) => {
    const { chart, repo, version, releaseName, namespace, valuesYaml } = req.body;

    if (!chart || !repo || !releaseName || !namespace) {
        return res.status(400).json({ error: 'Chart, repo, releaseName, and namespace are required' });
    }

    try {
        let command = `helm install ${releaseName} ${chart}`;
        if (repo) command += ` --repo ${repo}`;
        if (version) command += ` --version ${version}`;
        command += ` --namespace ${namespace}`;
        if (valuesYaml) {
            // Write values to temp file
            const fs = require('fs');
            const path = require('path');
            const os = require('os');
            const tempFile = path.join(os.tmpdir(), `helm-values-${Date.now()}.yaml`);
            fs.writeFileSync(tempFile, valuesYaml);
            command += ` --values ${tempFile}`;
        }
        command += ` --create-namespace`;

        console.log(`Executing: ${command}`);
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
        console.error('Helm install error:', error);
        res.status(500).json({ error: 'Failed to install Helm chart', details: error.message });
    }
});

// Get PersistentVolumeClaims
app.get('/api/persistentvolumeclaims', async (req, res) => {
    let namespace = 'default';
    if (req.query.namespace && typeof req.query.namespace === 'string') {
        namespace = req.query.namespace;
    }
    try {
        const output = await executeKubectl(`get pvc -n ${namespace} -o json`);
        const data = JSON.parse(output);
        res.json(data.items);
    } catch (error) {
        console.error(`Error fetching PVCs in namespace ${namespace}:`, error);
        res.status(500).json({ error: `Failed to fetch PVCs`, details: error.message });
    }
});

// Get StorageClasses
app.get('/api/storageclasses', async (req, res) => {
    try {
        const output = await executeKubectl('get sc -o json');
        const data = JSON.parse(output);
        res.json(data.items);
    } catch (error) {
        console.error('Error fetching StorageClasses:', error);
        res.status(500).json({ error: 'Failed to fetch StorageClasses', details: error.message });
    }
});

// --- Access Control Endpoints (RBAC) ---

// Get ServiceAccounts
app.get('/api/serviceaccounts', async (req, res) => {
    let namespace = 'default';
    if (req.query.namespace && typeof req.query.namespace === 'string') {
        namespace = req.query.namespace;
    }
    try {
        const output = await executeKubectl(`get serviceaccounts -n ${namespace} -o json`);
        const data = JSON.parse(output);
        res.json(data.items);
    } catch (error) {
        console.error(`Error fetching ServiceAccounts in namespace ${namespace}:`, error);
        res.status(500).json({ error: `Failed to fetch ServiceAccounts`, details: error.message });
    }
});

// Get Roles
app.get('/api/roles', async (req, res) => {
    let namespace = 'default';
    if (req.query.namespace && typeof req.query.namespace === 'string') {
        namespace = req.query.namespace;
    }
    try {
        const output = await executeKubectl(`get roles -n ${namespace} -o json`);
        const data = JSON.parse(output);
        res.json(data.items);
    } catch (error) {
        console.error(`Error fetching Roles in namespace ${namespace}:`, error);
        res.status(500).json({ error: `Failed to fetch Roles`, details: error.message });
    }
});

// Get ClusterRoles
app.get('/api/clusterroles', async (req, res) => {
    try {
        const output = await executeKubectl(`get clusterroles -o json`);
        const data = JSON.parse(output);
        res.json(data.items);
    } catch (error) {
        console.error(`Error fetching ClusterRoles:`, error);
        res.status(500).json({ error: `Failed to fetch ClusterRoles`, details: error.message });
    }
});

// Get RoleBindings
app.get('/api/rolebindings', async (req, res) => {
    let namespace = 'default';
    if (req.query.namespace && typeof req.query.namespace === 'string') {
        namespace = req.query.namespace;
    }
    try {
        const output = await executeKubectl(`get rolebindings -n ${namespace} -o json`);
        const data = JSON.parse(output);
        res.json(data.items);
    } catch (error) {
        console.error(`Error fetching RoleBindings in namespace ${namespace}:`, error);
        res.status(500).json({ error: `Failed to fetch RoleBindings`, details: error.message });
    }
});

// --- Helm Management (k3s CRDs) ---

// Get HelmCharts
app.get('/api/helmcharts', async (req, res) => {
    let namespace = 'default';
    if (req.query.namespace && typeof req.query.namespace === 'string') {
        namespace = req.query.namespace;
    }
    try {
        // k3s stores HelmCharts in helm.cattle.io group
        const output = await executeKubectl(`get helmcharts.helm.cattle.io -n ${namespace} -o json`);
        const data = JSON.parse(output);
        res.json(data.items);
    } catch (error) {
        // If CRD doesn't exist (not k3s?), return empty list gracefully
        if (error.message.includes('error: the server doesn\'t have a resource type')) {
            return res.json([]);
        }
        console.error(`Error fetching HelmCharts in namespace ${namespace}:`, error);
        res.status(500).json({ error: `Failed to fetch HelmCharts`, details: error.message });
    }
});

// Get HelmChartConfigs
app.get('/api/helmchartconfigs', async (req, res) => {
    let namespace = 'default';
    if (req.query.namespace && typeof req.query.namespace === 'string') {
        namespace = req.query.namespace;
    }
    try {
        const output = await executeKubectl(`get helmchartconfigs.helm.cattle.io -n ${namespace} -o json`);
        const data = JSON.parse(output);
        res.json(data.items);
    } catch (error) {
        if (error.message.includes('error: the server doesn\'t have a resource type')) {
            return res.json([]);
        }
        console.error(`Error fetching HelmChartConfigs in namespace ${namespace}:`, error);
        res.status(500).json({ error: `Failed to fetch HelmChartConfigs`, details: error.message });
    }
});

// --- Configuration Endpoints ---

// Get ConfigMaps
app.get('/api/configmaps', async (req, res) => {
    let namespace = 'default';
    if (req.query.namespace && typeof req.query.namespace === 'string') {
        namespace = req.query.namespace;
    }
    try {
        const output = await executeKubectl(`get configmaps -n ${namespace} -o json`);
        const data = JSON.parse(output);
        res.json(data.items);
    } catch (error) {
        console.error(`Error fetching ConfigMaps in namespace ${namespace}:`, error);
        res.status(500).json({ error: `Failed to fetch ConfigMaps`, details: error.message });
    }
});

// Get Secrets
app.get('/api/secrets', async (req, res) => {
    let namespace = 'default';
    if (req.query.namespace && typeof req.query.namespace === 'string') {
        namespace = req.query.namespace;
    }
    try {
        const output = await executeKubectl(`get secrets -n ${namespace} -o json`);
        const data = JSON.parse(output);
        res.json(data.items);
    } catch (error) {
        console.error(`Error fetching Secrets in namespace ${namespace}:`, error);
        res.status(500).json({ error: `Failed to fetch Secrets`, details: error.message });
    }
});

// --- Network Endpoints ---

// Get Ingresses
app.get('/api/ingresses', async (req, res) => {
    const { namespace = 'default' } = req.query;
    try {
        const nsFlag = namespace === 'all' ? '--all-namespaces' : `-n ${namespace}`;
        const output = await executeKubectl(`get ingresses ${nsFlag} -o json`);
        const ingresses = JSON.parse(output);
        res.json(namespace === 'all' ? ingresses.items : ingresses.items);
    } catch (error) {
        console.error('Ingresses fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch ingresses' });
    }
});

// Get Nodes
app.get('/api/nodes', async (req, res) => {
    try {
        const output = await executeKubectl('get nodes -o json');
        const data = JSON.parse(output);
        res.json(data.items);
    } catch (error) {
        console.error('Error fetching nodes:', error);
        res.status(500).json({ error: 'Failed to fetch nodes', details: error.message });
    }
});

// Get Pods
app.get('/api/pods', async (req, res) => {
    const { namespace = 'default' } = req.query;
    try {
        const nsFlag = namespace === 'all' ? '--all-namespaces' : `-n ${namespace}`;
        const output = await executeKubectl(`get pods ${nsFlag} -o json`);
        const pods = JSON.parse(output);
        res.json(namespace === 'all' ? pods.items : pods.items);
    } catch (error) {
        console.error('Pods fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch pods' });
    }
});

// Get Deployments
app.get('/api/deployments', async (req, res) => {
    const { namespace = 'default' } = req.query;
    try {
        const nsFlag = namespace === 'all' ? '--all-namespaces' : `-n ${namespace}`;
        const output = await executeKubectl(`get deployments ${nsFlag} -o json`);
        const deployments = JSON.parse(output);
        res.json(namespace === 'all' ? deployments.items : deployments.items);
    } catch (error) {
        console.error('Deployments fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch deployments' });
    }
});

// Get Services
app.get('/api/services', async (req, res) => {
    const { namespace = 'default' } = req.query;
    try {
        const nsFlag = namespace === 'all' ? '--all-namespaces' : `-n ${namespace}`;
        const output = await executeKubectl(`get services ${nsFlag} -o json`);
        const services = JSON.parse(output);
        res.json(namespace === 'all' ? services.items : services.items);
    } catch (error) {
        console.error('Services fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch services' });
    }
});

// Get DaemonSets
app.get('/api/daemonsets', async (req, res) => {
    let namespace = 'default';
    if (req.query.namespace && typeof req.query.namespace === 'string') {
        namespace = req.query.namespace;
    }
    try {
        const output = await executeKubectl(`get daemonsets -n ${namespace} -o json`);
        const data = JSON.parse(output);
        res.json(data.items);
    } catch (error) {
        console.error(`Error fetching daemonsets in namespace ${namespace}:`, error);
        res.status(500).json({ error: `Failed to fetch daemonsets in namespace ${namespace}`, details: error.message });
    }
});

// Get ReplicaSets
app.get('/api/replicasets', async (req, res) => {
    let namespace = 'default';
    if (req.query.namespace && typeof req.query.namespace === 'string') {
        namespace = req.query.namespace;
    }
    try {
        const output = await executeKubectl(`get replicasets -n ${namespace} -o json`);
        const data = JSON.parse(output);
        res.json(data.items);
    } catch (error) {
        console.error(`Error fetching replicasets in namespace ${namespace}:`, error);
        res.status(500).json({ error: `Failed to fetch replicasets in namespace ${namespace}`, details: error.message });
    }
});

// --- Generic Resource Management Endpoints ---

// Get Resource YAML
app.get('/api/resources/:type/:name/yaml', async (req, res) => {
    const { type, name } = req.params;
    const namespace = String(req.query.namespace || 'default');
    
    try {
        const output = await executeKubectl(`get ${type} ${name} -n ${namespace} -o yaml`);
        res.json({ yaml: output });
    } catch (error) {
        console.error(`Error fetching YAML for ${type}/${name}:`, error);
        res.status(500).json({ error: `Failed to fetch YAML`, details: error.message });
    }
});

// Apply Resource (Create/Update) via YAML
app.post('/api/resources/apply', async (req, res) => {
    const { yaml } = req.body;
    if (!yaml) return res.status(400).json({ error: 'YAML content is required' });

    try {
        const output = await executeKubectlWithStdin(['apply', '-f', '-'], yaml);
        res.json({ message: 'Resource applied successfully', output });
    } catch (error) {
        console.error('Error applying resource:', error);
        res.status(500).json({ error: 'Failed to apply resource', details: error.message });
    }
});

// Delete Resource
app.delete('/api/resources/:type/:name', async (req, res) => {
    const { type, name } = req.params;
    const namespace = String(req.query.namespace || 'default');

    try {
        await executeKubectl(`delete ${type} ${name} -n ${namespace}`);
        res.json({ message: `${type} ${name} deleted successfully` });
    } catch (error) {
        console.error(`Error deleting ${type}/${name}:`, error);
        res.status(500).json({ error: `Failed to delete ${type}`, details: error.message });
    }
});

// Scale Resource
app.post('/api/resources/:type/:name/scale', async (req, res) => {
    const { type, name } = req.params;
    const namespace = String(req.query.namespace || 'default');
    const { replicas } = req.body;

    if (replicas === undefined || replicas === null) {
        return res.status(400).json({ error: 'Replicas count is required' });
    }

    try {
        await executeKubectl(`scale ${type} ${name} --replicas=${replicas} -n ${namespace}`);
        res.json({ message: `${type} ${name} scaled to ${replicas} replicas` });
    } catch (error) {
        console.error(`Error scaling ${type}/${name}:`, error);
        res.status(500).json({ error: `Failed to scale ${type}`, details: error.message });
    }
});

// --- API Endpoint: Kubectl Execution ---

app.post('/api/kubectl', async (req, res) => {
    const { command } = req.body;

    if (!command || typeof command !== 'string' || command.trim() === '') {
        return res.status(400).json({ error: 'Command is required.' });
    }

    // Validate that the command starts with "kubectl"
    if (!command.trim().startsWith('kubectl ')) {
        return res.status(400).json({
            error: 'Command must start with "kubectl".',
            example: 'kubectl get pods'
        });
    }

    // Extract the kubectl command (remove "kubectl " prefix)
    const kubectlCommand = command.trim().substring(8);

    // ⚠️ WARNING: This endpoint now allows ALL kubectl commands including destructive ones
    // In a production environment, you should implement proper authentication and authorization

    try {
        const output = await executeKubectl(kubectlCommand);
        res.json({ output });
    } catch (error) {
        // executeKubectl rejects with an Error object containing the stderr
        res.status(500).json({ error: 'Kubectl command failed', details: error.message });
    }
});

// --- API Endpoints: Cluster Management (k3d) ---

// List k3d clusters
app.get('/api/clusters', async (req, res) => {
    try {
        const output = await executeK3d('cluster list --output json');
        const clusters = JSON.parse(output || '[]');
        const processedClusters = clusters.map(cluster => {
            let oldestCreated = new Date().toISOString();
            if (cluster.nodes && cluster.nodes.length > 0) {
                // Find the earliest created date among all nodes (which is the cluster creation date)
                oldestCreated = cluster.nodes.reduce((minDate, node) => {
                    // Use a safe check in case 'created' field is missing or malformed
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
        console.error('Error listing clusters:', error);

        // Check if the error is related to Docker not running
        const errorMessage = error.message;
        if (errorMessage.includes('Cannot connect to the Docker daemon') ||
            errorMessage.includes('docker daemon running')) {
            res.status(500).json({
                error: 'Docker daemon is not running',
                details: 'k3d requires Docker to be running. Please start Docker Desktop or the Docker daemon.',
                suggestion: 'Start Docker Desktop and try again.'
            });
        } else {
            res.status(500).json({ error: 'Failed to list clusters', details: error.message });
        }
    }
});

// Create a new k3d cluster
app.post('/api/clusters', async (req, res) => {
    const { name, options } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ error: 'Cluster name is required.' });
    }

    const clusterName = name.trim();
    let command = `cluster create ${clusterName}`;

    // Add additional options if provided
    if (options && typeof options === 'object') {
        if (options.agents) command += ` --agents ${options.agents}`;
        if (options.servers) command += ` --servers ${options.servers}`;
        if (options.k3sVersion) command += ` --image rancher/k3s:${options.k3sVersion}`;
        if (options.port) command += ` --port ${options.port}`;
    }

    try {
        const output = await executeK3d(command);
        res.json({ message: 'Cluster created successfully', output });
    } catch (error) {
        console.error('Error creating cluster:', error);

        // Check if the error is related to Docker not running
        const errorMessage = error.message;
        if (errorMessage.includes('Cannot connect to the Docker daemon') ||
            errorMessage.includes('docker daemon running')) {
            res.status(500).json({
                error: 'Docker daemon is not running',
                details: 'k3d requires Docker to be running. Please start Docker Desktop or the Docker daemon.',
                suggestion: 'Start Docker Desktop and try again.'
            });
        } else {
            res.status(500).json({ error: 'Failed to create cluster', details: error.message });
        }
    }
});

// Delete a k3d cluster
app.delete('/api/clusters/:name', async (req, res) => {
    const { name } = req.params;

    if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ error: 'Cluster name is required.' });
    }

    try {
        const output = await executeK3d(`cluster delete ${name}`);
        res.json({ message: 'Cluster deleted successfully', output });
    } catch (error) {
        console.error('Error deleting cluster:', error);

        // Check if the error is related to Docker not running
        const errorMessage = error.message;
        if (errorMessage.includes('Cannot connect to the Docker daemon') ||
            errorMessage.includes('docker daemon running')) {
            res.status(500).json({
                error: 'Docker daemon is not running',
                details: 'k3d requires Docker to be running. Please start Docker Desktop or the Docker daemon.',
                suggestion: 'Start Docker Desktop and try again.'
            });
        } else {
            res.status(500).json({ error: 'Failed to delete cluster', details: error.message });
        }
    }
});

// Get cluster info/details
app.get('/api/clusters/:name', async (req, res) => {
    const { name } = req.params;

    try {
        const output = await executeK3d(`cluster list ${name} --output json`);
        const clusters = JSON.parse(output || '[]');
        const cluster = clusters.find(c => c.name === name);

        if (!cluster) {
            return res.status(404).json({ error: 'Cluster not found' });
        }

        res.json(cluster);
    } catch (error) {
        console.error('Error getting cluster info:', error);
        res.status(500).json({ error: 'Failed to get cluster info', details: error.message });
    }
});

// Switch kubectl context to a specific cluster
app.post('/api/clusters/:name/switch', async (req, res) => {
    const { name } = req.params;

    try {
        const output = await executeK3d(`kubeconfig merge ${name} --kubeconfig-switch-context`);
        res.json({ message: 'Switched kubectl context successfully', output });
    } catch (error) {
        console.error('Error switching context:', error);
        res.status(500).json({ error: 'Failed to switch context', details: error.message });
    }
});

// Check if k3d is installed
app.get('/api/k3d/status', async (req, res) => {
    try {
        const output = await executeK3d('cluster list --output json');
        res.json({ installed: true, version: 'installed' });
    } catch (error) {
        console.error('k3d status error:', error);
        // Check if the error is related to Docker not running
        const errorMessage = error.message;
        if (errorMessage.includes('Cannot connect to the Docker daemon') ||
            errorMessage.includes('docker daemon running')) {
            res.status(500).json({ installed: false, error: 'Docker daemon is not running' });
        } else if (errorMessage.includes('k3d: command not found') || errorMessage.includes('no such file')) {
            res.status(500).json({ installed: false, error: 'k3d is not installed' });
        } else {
            res.status(500).json({ installed: false, error: error.message });
        }
    }
});

// Get cluster version info
app.get('/api/cluster/version', async (req, res) => {
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
        res.status(500).json({ error: 'Failed to get version info' });
    }
});

// Get recent cluster events
app.get('/api/events', async (req, res) => {
    try {
        const output = await executeKubectl(`get events --all-namespaces --sort-by=.lastTimestamp -o json`);
        const events = JSON.parse(output);
        // Return last 10 events
        res.json(events.items.slice(-10));
    } catch (error) {
        console.error('Events fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});



// --- Server Startup ---
app.listen(port, () => {
    console.log(`K3s UI Management Backend listening on port ${port}`);
    console.log('API documentation:');
    console.log(`- Nodes: http://localhost:${port}/api/nodes`);
    console.log(`- Kubectl: POST http://localhost:${port}/api/kubectl`);
    console.log(`- Clusters: http://localhost:${port}/api/clusters`);
    console.log(`- k3d Status: http://localhost:${port}/api/k3d/status`);
});

export default app;
