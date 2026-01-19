# K3s UI Management

A modern, lightweight web dashboard for managing local k3s clusters powered by k3d. This UI provides a comprehensive set of tools to visualize, manage, and interact with your Kubernetes resources without the overhead of heavy, enterprise-grade dashboards.

![Dashboard Screenshot](https://i.imgur.com/example.png)
*(Replace with a real screenshot of the application dashboard)*

---

## ✨ Features

- **Comprehensive Dashboard:** A single-pane-of-glass overview of your cluster, including:
  - **Resource Statistics:** Real-time counts for Pods, Services, Ingresses, Deployments, and Nodes.
  - **Expanded Details:** View lists of all resources directly from the dashboard with their current status.
  - **Cluster Health:** At-a-glance view of Kubernetes and k3d versions.
  - **Recent Events Feed:** A live feed of the latest 10 cluster-wide events to monitor activity.

- **Full Resource Management:**
  - **Browse & View:** Detailed table views for all major Kubernetes resources (Pods, Deployments, Services, Ingresses, DaemonSets, ReplicaSets, etc.).
  - **Full CRUD:** Create, Edit (via YAML), and Delete resources directly from the UI.
  - **Scale Workloads:** Easily scale your Deployments up or down.

- **Helm Integration:**
  - **Artifact Hub Search:** Search for Helm charts from Artifact Hub without leaving the application.
  - **Direct Installation:** Install Helm charts into any namespace with a simple modal form.

- **Advanced Networking Tools:**
  - **Ingress Management:** View and manage Ingress resources.
  - **Network Topology:** A text-based tree diagram that visualizes the connections between Ingresses, Services, Deployments, and Pods.

- **Embedded Kubectl Terminal:**
  - A fully functional, web-based terminal to run `kubectl` commands directly against your cluster.
  - Includes command history for ease of use.

## 🛠️ Tech Stack

- **Frontend:**
  - **Framework:** React with Vite
  - **Language:** TypeScript
  - **Styling:** Tailwind CSS
  - **Icons:** Lucide React

- **Backend:**
  - **Framework:** Node.js with Express
  - **Functionality:** Acts as a proxy to execute `kubectl`, `helm`, and `k3d` commands on the host system.

##  Prerequisites

Before you begin, ensure you have the following tools installed on your machine:
- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/)
- [kubectl](https://kubernetes.io/docs/tasks/tools/install-kubectl/)
- [k3d](https://k3d.io/v5.6.0/#installation)
- [Helm](https://helm.sh/docs/intro/install/)

## 🚀 Getting Started

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/alanhex/k3s-UI-management.git
    cd k3s-UI-management
    ```

2.  **Install dependencies:**
    This will install dependencies for both the `server` and `client`.
    ```bash
    npm install
    ```

3.  **Create a k3d cluster:**
    If you don't have one already, create a new local cluster.
    ```bash
    k3d cluster create my-cluster
    ```
    *This command will also automatically configure your `kubectl` context to point to the new cluster.*

4.  **Run the application:**
    This command starts both the backend server and the frontend client in parallel.
    ```bash
    npm run dev
    ```

5.  **Open the UI:**
    Navigate to [http://localhost:5173](http://localhost:5173) in your web browser.

## Usage

- **Dashboard:** The landing page provides a complete overview of your cluster's status and resources.
- **Navigation:** Use the sidebar to navigate to detailed views of each resource type.
- **Namespace Selector:** Use the dropdown in the header to filter resources by a specific namespace. The dashboard always shows cluster-wide stats.
- **Actions:** Use the action buttons in the table views to edit YAML, scale, or delete resources.

---

This project is licensed under the MIT License.
