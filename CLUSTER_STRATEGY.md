# Qdrant Cluster Strategy

This document explains the cluster deployment strategy for the AWSNA AI Center knowledge management system.

## Overview

The system supports both single-cluster and multi-cluster deployments to accommodate different client needs and compliance requirements.

### Knowledge Collections

Each school organization can have multiple knowledge collections:
- **Curriculum**: Educational content, syllabi, lesson plans
- **Accreditation**: Compliance documents, audit reports, standards
- **Marketing**: Brochures, social media content, brand guidelines
- **Administration**: Staff handbooks, policies, procedures
- **General**: Calendars, FAQs, general information
- **School Renewal**: Archived newsletters, school publications, historical documents

These collections are organized using namespace isolation to ensure complete data separation between schools.

## Deployment Modes

### 1. Single Cluster (Default)
- **Use case**: Small to medium schools, development/testing
- **Cost**: Lower infrastructure costs
- **Isolation**: Namespace-based isolation using `schoolId_collection` naming
- **Environment variable**: `QDRANT_DEPLOYMENT_MODE=SINGLE_CLUSTER`

**Example structure:**
```
Qdrant Single Cluster
├── awsna_curriculum
│   ├── "Math Curriculum 2024.pdf"
│   ├── "Science Standards.docx"
│   └── "History Syllabus.pdf"
├── awsna_accreditation
│   ├── "WASC Accreditation Report.pdf"
│   └── "Compliance Checklist.xlsx"
├── awsna_school-renewal
│   ├── "Newsletter Spring 2023.pdf"
│   ├── "Newsletter Fall 2022.pdf"
│   └── "Newsletter Winter 2021.pdf"
├── school456_curriculum      ← Different school
│   ├── "English Literature.pdf"
│   └── "Art Program Guide.pdf"
└── school456_marketing       ← Different school
    ├── "School Brochure.pdf"
    └── "Social Media Guidelines.docx"
```

### 2. Multi-Cluster
- **Use case**: Enterprise clients, compliance requirements, high-volume schools
- **Cost**: Higher infrastructure costs
- **Isolation**: Complete cluster separation
- **Environment variable**: `QDRANT_DEPLOYMENT_MODE=MULTI_CLUSTER`

**Example structure:**
```
Enterprise Cluster
├── enterprise_school123_curriculum
├── enterprise_school123_accreditation
├── enterprise_school123_school-renewal
└── enterprise_school456_marketing

EU Cluster (GDPR compliant)
├── eu_school789_curriculum
├── eu_school789_administration
├── eu_school789_school-renewal
└── eu_school101_general

Default Cluster
├── default_school202_curriculum
├── default_school202_marketing
└── default_school202_school-renewal
```

## Configuration

### Environment Variables

#### Single Cluster Mode
```bash
QDRANT_DEPLOYMENT_MODE=SINGLE_CLUSTER
QDRANT_URL=https://your-qdrant-instance.com
QDRANT_API_KEY=your-api-key
```

#### Multi-Cluster Mode
```bash
QDRANT_DEPLOYMENT_MODE=MULTI_CLUSTER
QDRANT_URL=https://default-cluster.com
QDRANT_API_KEY=default-api-key
QDRANT_ENTERPRISE_URL=https://enterprise-cluster.com
QDRANT_ENTERPRISE_API_KEY=enterprise-api-key
QDRANT_EU_URL=https://eu-cluster.com
QDRANT_EU_API_KEY=eu-api-key
```

### School to Cluster Mapping

For multi-cluster deployments, configure which schools use which clusters:

```typescript
// In src/lib/cluster-config.ts
export const SCHOOL_CLUSTER_MAPPING: SchoolClusterMapping[] = [
  { schoolId: 'enterprise-school-123', clusterName: 'enterprise' },
  { schoolId: 'eu-school-456', clusterName: 'eu' }
];
```

## Collection Naming

### Single Cluster
Collections are named: `schoolId_collection`
- Example: `school123_curriculum`, `school456_accreditation`

**Real-world example for a school organization:**
```
awsna_curriculum          ← Math, Science, History documents
awsna_accreditation       ← WASC reports, compliance docs
awsna_marketing           ← Brochures, social media guidelines
awsna_administration      ← Staff handbooks, policies
awsna_general             ← Calendar, FAQ, general info
awsna_school-renewal      ← Archived newsletters, publications
```

### Multi-Cluster
Collections are named: `clusterName_schoolId_collection`
- Example: `enterprise_school123_curriculum`, `eu_school456_marketing`

## Migration Strategy

### From Single to Multi-Cluster

1. **Backup existing data**
2. **Set up new clusters**
3. **Update environment variables**
4. **Configure school mappings**
5. **Migrate data** (if needed)
6. **Update deployment mode**

### Data Migration Script

```typescript
// Example migration script
async function migrateSchoolToCluster(schoolId: string, targetCluster: string) {
  // 1. Export data from source cluster
  const documents = await listDocuments(`${schoolId}_*`);
  
  // 2. Upload to target cluster with new naming
  for (const doc of documents) {
    const newCollectionName = `${targetCluster}_${schoolId}_${doc.collection}`;
    await uploadDocument(newCollectionName, doc.content, doc.metadata);
  }
  
  // 3. Update school mapping
  // 4. Verify migration
  // 5. Clean up old data
}
```

## Security Considerations

### Single Cluster
- **Namespace isolation**: Relies on application-level access controls
- **Risk**: Potential data leakage if access controls are bypassed
- **Mitigation**: Strong authentication and authorization
- **Data separation**: Each school's collections are completely isolated by naming convention

### Multi-Cluster
- **Physical isolation**: Complete separation of data
- **Risk**: Lower risk of cross-client data access
- **Compliance**: Better for GDPR, HIPAA, etc.
- **Geographic isolation**: Can place clusters in different regions for data residency

## Performance Considerations

### Single Cluster
- **Pros**: Shared resources, lower cost
- **Cons**: Resource contention, potential performance impact

### Multi-Cluster
- **Pros**: Dedicated resources, predictable performance
- **Cons**: Higher cost, resource underutilization

## Recommendations

### Start with Single Cluster
- Use for MVP and early customers
- Monitor usage and performance
- Implement strong access controls
- **Perfect for school organizations** with multiple knowledge collections

### Migrate to Multi-Cluster when:
- **Enterprise clients** require dedicated infrastructure
- **Compliance requirements** demand physical separation
- **Performance issues** arise from resource contention
- **Data residency** requirements (different geographic regions)
- **Large school districts** with high document volumes

### Hybrid Approach
- Keep small/medium schools on single cluster
- Move enterprise clients to dedicated clusters
- Use configuration to manage cluster selection
- **Example**: Small private schools on default cluster, large districts on enterprise cluster

## Monitoring

Monitor these metrics for cluster health:
- **Query latency**
- **Storage usage**
- **Memory consumption**
- **CPU utilization**
- **Error rates**

## Backup Strategy

### Single Cluster
- Regular backups of entire cluster
- Point-in-time recovery

### Multi-Cluster
- Individual cluster backups
- Cross-cluster data replication (if needed)
- Geographic distribution for disaster recovery 