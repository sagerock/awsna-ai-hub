export interface ClusterConfig {
  url: string;
  apiKey?: string;
  name: string;
  region?: string;
  description?: string;
}

export interface SchoolClusterMapping {
  schoolId: string;
  clusterName: string;
}

// Configuration for different deployment scenarios
export const CLUSTER_CONFIGS = {
  // Single cluster for all clients (current setup)
  SINGLE_CLUSTER: {
    default: {
      url: process.env.QDRANT_URL!,
      apiKey: process.env.QDRANT_API_KEY,
      name: 'default',
      description: 'Default cluster for all schools'
    }
  },
  
  // Multi-cluster setup for enterprise clients
  MULTI_CLUSTER: {
    default: {
      url: process.env.QDRANT_URL!,
      apiKey: process.env.QDRANT_API_KEY,
      name: 'default',
      description: 'Default cluster for small/medium schools'
    },
    enterprise: {
      url: process.env.QDRANT_ENTERPRISE_URL!,
      apiKey: process.env.QDRANT_ENTERPRISE_API_KEY,
      name: 'enterprise',
      description: 'Enterprise cluster for large schools'
    },
    eu: {
      url: process.env.QDRANT_EU_URL!,
      apiKey: process.env.QDRANT_EU_API_KEY,
      name: 'eu',
      description: 'EU cluster for GDPR compliance'
    }
  }
};

// School to cluster mapping (for multi-cluster setups)
export const SCHOOL_CLUSTER_MAPPING: SchoolClusterMapping[] = [
  // Example mappings - you can store these in a database
  // { schoolId: 'enterprise-school-123', clusterName: 'enterprise' },
  // { schoolId: 'eu-school-456', clusterName: 'eu' }
];

/**
 * Get cluster configuration based on deployment mode
 */
export function getClusterConfigs(): Record<string, ClusterConfig> {
  const deploymentMode = process.env.QDRANT_DEPLOYMENT_MODE || 'SINGLE_CLUSTER';
  return CLUSTER_CONFIGS[deploymentMode as keyof typeof CLUSTER_CONFIGS] || CLUSTER_CONFIGS.SINGLE_CLUSTER;
}

/**
 * Get cluster name for a specific school
 */
export function getClusterForSchool(schoolId: string): string {
  const mapping = SCHOOL_CLUSTER_MAPPING.find(m => m.schoolId === schoolId);
  return mapping?.clusterName || 'default';
}

/**
 * Check if a school should use a dedicated cluster
 */
export function shouldUseDedicatedCluster(schoolId: string): boolean {
  const clusterName = getClusterForSchool(schoolId);
  return clusterName !== 'default';
} 