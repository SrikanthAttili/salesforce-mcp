/**
 * Type definitions for Salesforce API responses
 */

export interface OAuthTokenResponse {
  access_token: string;
  instance_url: string;
  id: string;
  token_type: string;
  issued_at: string;
  signature: string;
}

export interface IdentityResponse {
  user_id: string;
  username: string;
  organization_id: string;
  display_name: string;
  email?: string;
  user_type?: string;
}

export interface UserInfo {
  userId: string;
  username: string;
  organizationId: string;
  displayName: string;
  email?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  userInfo?: UserInfo;
  error?: string;
}

export interface SalesforceConfig {
  loginUrl: string;
  clientId: string;
  clientSecret: string;
  apiVersion: string;
  timeout?: number;
}

export interface QueryResult<T = any> {
  totalSize: number;
  done: boolean;
  records: T[];
}

export interface SaveResult {
  id: string;
  success: boolean;
  errors: Array<{
    statusCode: string;
    message: string;
    fields: string[];
  }>;
}

export interface DescribeGlobalResult {
  encoding: string;
  maxBatchSize: number;
  sobjects: Array<{
    name: string;
    label: string;
    keyPrefix?: string;
    custom: boolean;
    updateable: boolean;
    createable: boolean;
    deletable: boolean;
  }>;
}

export interface FieldDescribe {
  name: string;
  label: string;
  type: string;
  length?: number;
  precision?: number;
  scale?: number;
  nillable?: boolean;
  updateable?: boolean;
  createable?: boolean;
  calculated?: boolean;
  defaultValue?: any;
  referenceTo?: string[];
  relationshipName?: string;
}

export interface DescribeSObjectResult {
  name: string;
  label: string;
  labelPlural: string;
  keyPrefix?: string;
  custom: boolean;
  fields: FieldDescribe[];
  recordTypeInfos?: Array<{
    name: string;
    recordTypeId: string;
    available: boolean;
    defaultRecordTypeMapping: boolean;
  }>;
}
