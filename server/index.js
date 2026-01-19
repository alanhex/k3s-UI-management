import express from 'express';
import cors from 'cors';
import * as k8s from '@kubernetes/client-node';
import { exec } from 'child_process';

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
    let namespace = 'default';
    if (req.query.namespace && typeof req.query.namespace === 'string') {
        namespace = req.query.namespace;
    }
    try {
        const output = await executeKubectl(`get pods -n ${namespace} -o json`);
        const data = JSON.parse(output);
        res.json(data.items);
    } catch (error) {
        console.error(`Error fetching pods in namespace ${namespace}:`, error);
        res.status(500).json({ error: `Failed to fetch pods in namespace ${namespace}`, details: error.message });
    }
});

// Get Deployments
app.get('/api/deployments', async (req, res) => {
    let namespace = 'default';
    if (req.query.namespace && typeof req.query.namespace === 'string') {
        namespace = req.query.namespace;
    }
    try {
        const output = await executeKubectl(`get deployments -n ${namespace} -o json`);
        const data = JSON.parse(output);
        res.json(data.items);
    } catch (error) {
        console.error(`Error fetching deployments in namespace ${namespace}:`, error);
        res.status(500).json({ error: `Failed to fetch deployments in namespace ${namespace}`, details: error.message });
    }
});

// Get Services
app.get('/api/services', async (req, res) => {
    let namespace = 'default';
    if (req.query.namespace && typeof req.query.namespace === 'string') {
        namespace = req.query.namespace;
    }
    try {
        const output = await executeKubectl(`get services -n ${namespace} -o json`);
        const data = JSON.parse(output);
        res.json(data.items);
    } catch (error) {
        console.error(`Error fetching services in namespace ${namespace}:`, error);
        res.status(500).json({ error: `Failed to fetch services in namespace ${namespace}`, details: error.message });
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
        // Check if k3d command exists and get version (will try both system and user paths)
        const output = await executeK3d('--version');
        const versionMatch = output.match(/k3d version (v?\d+\.\d+\.\d+)/i);
        const version = versionMatch ? versionMatch[1] : 'unknown';

        res.json({
            installed: true,
            version: version,
            output: output.trim()
        });
    } catch (error) {
        res.json({
            installed: false,
            error: error.message
        });
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