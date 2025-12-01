/**
 * Oracle Cloud Infrastructure (OCI) Object Storage provider config
 * Docs: https://docs.oracle.com/en-us/iaas/Content/Object/Concepts/objectstorageoverview.htm
 */
module.exports = {
  type: 'oracle',
  namespace: process.env.ORACLE_NAMESPACE || '',
  bucket: process.env.ORACLE_BUCKET || '',
  region: process.env.ORACLE_REGION || 'eu-frankfurt-1',

  // Authentication
  auth: {
    tenancyOcid: process.env.ORACLE_TENANCY_OCID || '',
    userOcid: process.env.ORACLE_USER_OCID || '',
    fingerprint: process.env.ORACLE_FINGERPRINT || '',
    privateKeyPath: process.env.ORACLE_PRIVATE_KEY_PATH || '~/.oci/oci_api_key.pem'
  }
};
