import { MetadataDatabase } from './database.js';

/**
 * Pre-flight Validation Service
 * Validates data against Salesforce metadata before API calls
 * Prevents common errors and provides intelligent warnings
 */
export class PreflightValidator {
  private db: MetadataDatabase;
  private debug: boolean;

  constructor(database: MetadataDatabase) {
    this.db = database;
    this.debug = process.env.DEBUG_VALIDATOR === 'true';
  }

  /**
   * Log debug messages if debug mode is enabled
   */
  private log(message: string): void {
    if (this.debug) {
      console.log(message);
    }
  }

  /**
   * Validate data before creating a record
   */
  async validateCreate(sobjectName: string, data: Record<string, any>): Promise<ValidationResult> {
    this.log(`🔍 Validating create operation for ${sobjectName}`);
    
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    };

    // Check if object exists in metadata
    const sobject = this.db.getSObject(sobjectName);
    if (!sobject) {
      result.valid = false;
      result.errors.push({
        field: '__sobject__',
        message: `Object '${sobjectName}' not found in metadata. Run metadata sync first.`,
        type: 'METADATA_NOT_FOUND',
      });
      return result;
    }

    // Check if object is createable
    if (!sobject.is_createable) {
      result.valid = false;
      result.errors.push({
        field: '__sobject__',
        message: `Object '${sobjectName}' is not createable. Check CRUD permissions.`,
        type: 'CRUD_PERMISSION',
      });
      return result;
    }

    // Get all fields for this object
    const allFields = this.db.getFields(sobjectName);
    const requiredFields = this.db.getRequiredFields(sobjectName);

    // Validate required fields
    this.validateRequiredFields(requiredFields, data, result);

    // Validate field types, lengths, and values
    this.validateFields(allFields, data, result);

    // Check for validation rules
    this.checkValidationRules(sobjectName, result);

    // Check for missing parent records (relationships)
    this.checkRelationships(sobjectName, data, result);

    this.log(`✅ Validation complete: ${result.valid ? 'PASSED' : 'FAILED'}`);
    return result;
  }

  /**
   * Validate data before updating a record
   */
  async validateUpdate(sobjectName: string, recordId: string, data: Record<string, any>): Promise<ValidationResult> {
    this.log(`🔍 Validating update operation for ${sobjectName} (${recordId})`);
    
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    };

    // Check if object exists in metadata
    const sobject = this.db.getSObject(sobjectName);
    if (!sobject) {
      result.valid = false;
      result.errors.push({
        field: '__sobject__',
        message: `Object '${sobjectName}' not found in metadata. Run metadata sync first.`,
        type: 'METADATA_NOT_FOUND',
      });
      return result;
    }

    // Check if object is updateable
    if (!sobject.is_updateable) {
      result.valid = false;
      result.errors.push({
        field: '__sobject__',
        message: `Object '${sobjectName}' is not updateable. Check CRUD permissions.`,
        type: 'CRUD_PERMISSION',
      });
      return result;
    }

    // Get all fields for this object
    const allFields = this.db.getFields(sobjectName);

    // For updates, we don't check required fields (only validate provided fields)
    this.validateFields(allFields, data, result);

    // Check for validation rules
    this.checkValidationRules(sobjectName, result);

    // Check for relationships in update data
    this.checkRelationships(sobjectName, data, result);

    this.log(`✅ Validation complete: ${result.valid ? 'PASSED' : 'FAILED'}`);
    return result;
  }

  /**
   * Validate required fields are present
   */
  private validateRequiredFields(
    requiredFields: any[],
    data: Record<string, any>,
    result: ValidationResult
  ): void {
    // Filter out system fields that are auto-populated by Salesforce
    const systemFields = ['Id', 'IsDeleted', 'CreatedDate', 'CreatedById', 'LastModifiedDate', 
                         'LastModifiedById', 'SystemModstamp', 'LastViewedDate', 'LastReferencedDate'];
    
    // Filter out boolean fields that Salesforce auto-populates to false
    const booleanDefaultFields = ['IsExcludedFromRealign', 'IsPartner', 'IsCustomerPortal', 
                                   'HasOptedOutOfEmail', 'HasOptedOutOfFax', 'DoNotCall', 
                                   'IsEmailBounced', 'IsPriorityRecord'];
    
    // Filter out fields that typically have auto-defaults (but NOT Name - that's user-required)
    const autoDefaultedFields = ['OwnerId']; // OwnerId defaults to current user
    
    const excludedFields = [...systemFields, ...booleanDefaultFields, ...autoDefaultedFields];
    
    // Also exclude fields with default values
    const userRequiredFields = requiredFields.filter(f => {
      if (excludedFields.includes(f.name)) return false;
      // Skip fields that have default values
      if (f.default_value !== null && f.default_value !== undefined && f.default_value !== '') return false;
      return true;
    });

    for (const field of userRequiredFields) {
      // Check if field is provided and not null/undefined/empty
      if (data[field.name] === undefined || data[field.name] === null || data[field.name] === '') {
        result.valid = false;
        result.errors.push({
          field: field.name,
          message: `Required field '${field.label}' is missing or empty.`,
          type: 'REQUIRED_FIELD',
          suggestion: `Provide a value for ${field.name} (${field.type})`,
        });
      }
    }
  }

  /**
   * Validate field types, lengths, and values
   */
  private validateFields(
    allFields: any[],
    data: Record<string, any>,
    result: ValidationResult
  ): void {
    for (const fieldName in data) {
      const field = allFields.find(f => f.name === fieldName);
      
      if (!field) {
        result.warnings.push({
          field: fieldName,
          message: `Field '${fieldName}' not found in metadata. It may not exist or you may lack access.`,
          type: 'UNKNOWN_FIELD',
        });
        continue;
      }

      const value = data[fieldName];

      // Skip null values (they're allowed for non-required fields)
      if (value === null || value === undefined) {
        continue;
      }

      // Type validation
      this.validateFieldType(field, value, result);

      // Length validation for strings
      if (field.type === 'string' && field.length && typeof value === 'string') {
        if (value.length > field.length) {
          result.valid = false;
          result.errors.push({
            field: fieldName,
            message: `Field '${field.label}' exceeds maximum length of ${field.length} characters (provided: ${value.length}).`,
            type: 'LENGTH_EXCEEDED',
          });
        }
      }

      // Picklist validation
      if (field.type === 'picklist' && field.picklist_values) {
        this.validatePicklist(field, value, result);
      }

      // Number validation (precision and scale)
      if ((field.type === 'double' || field.type === 'currency' || field.type === 'percent') && 
          typeof value === 'number') {
        this.validateNumber(field, value, result);
      }
    }
  }

  /**
   * Validate field type matches expected type
   */
  private validateFieldType(field: any, value: any, result: ValidationResult): void {
    const fieldType = field.type.toLowerCase();
    const valueType = typeof value;

    const typeMap: Record<string, string[]> = {
      'string': ['string'],
      'textarea': ['string'],
      'email': ['string'],
      'url': ['string'],
      'phone': ['string'],
      'picklist': ['string'],
      'multipicklist': ['string'],
      'id': ['string'],
      'reference': ['string'],
      'int': ['number'],
      'double': ['number'],
      'currency': ['number'],
      'percent': ['number'],
      'boolean': ['boolean'],
      'date': ['string'], // ISO date string
      'datetime': ['string'], // ISO datetime string
      'time': ['string'],
    };

    const expectedTypes = typeMap[fieldType] || ['any'];
    
    if (!expectedTypes.includes('any') && !expectedTypes.includes(valueType)) {
      result.valid = false;
      result.errors.push({
        field: field.name,
        message: `Field '${field.label}' expects type ${expectedTypes.join(' or ')} but got ${valueType}.`,
        type: 'TYPE_MISMATCH',
        suggestion: `Convert value to ${expectedTypes[0]}`,
      });
    }
  }

  /**
   * Validate picklist value
   */
  private validatePicklist(field: any, value: string, result: ValidationResult): void {
    const picklistValues = JSON.parse(field.picklist_values);
    const validValues = picklistValues.map((pv: any) => pv.value);

    if (!validValues.includes(value)) {
      result.valid = false;
      result.errors.push({
        field: field.name,
        message: `Invalid picklist value '${value}' for field '${field.label}'.`,
        type: 'INVALID_PICKLIST_VALUE',
        suggestion: `Valid values: ${validValues.slice(0, 10).join(', ')}${validValues.length > 10 ? '...' : ''}`,
      });
    }
  }

  /**
   * Validate number precision and scale
   */
  private validateNumber(field: any, value: number, result: ValidationResult): void {
    if (field.precision_val) {
      const valueStr = value.toString().replace('.', '');
      if (valueStr.length > field.precision_val) {
        result.warnings.push({
          field: field.name,
          message: `Field '${field.label}' may exceed precision of ${field.precision_val} digits.`,
          type: 'PRECISION_WARNING',
        });
      }
    }

    if (field.scale !== null && field.scale !== undefined) {
      const decimalPart = value.toString().split('.')[1] || '';
      if (decimalPart.length > field.scale) {
        result.warnings.push({
          field: field.name,
          message: `Field '${field.label}' has ${decimalPart.length} decimal places but max is ${field.scale}.`,
          type: 'SCALE_WARNING',
          suggestion: `Round to ${field.scale} decimal places`,
        });
      }
    }
  }

  /**
   * Check for active validation rules
   */
  private checkValidationRules(sobjectName: string, result: ValidationResult): void {
    const validationRules = this.db.getValidationRules(sobjectName);
    
    if (validationRules.length > 0) {
      result.warnings.push({
        field: '__validation_rules__',
        message: `This object has ${validationRules.length} active validation rule(s) that may prevent save.`,
        type: 'VALIDATION_RULES_EXIST',
        details: validationRules.map(r => ({
          name: r.name,
          errorMessage: r.error_message,
          formula: r.formula,
        })),
      });
    }
  }

  /**
   * Check for relationship dependencies
   */
  private checkRelationships(sobjectName: string, data: Record<string, any>, result: ValidationResult): void {
    const relationships = this.db.getRelationships(sobjectName);
    
    // System-managed relationship fields (auto-populated by Salesforce)
    const systemRelationships = ['OwnerId', 'CreatedById', 'LastModifiedById', 'RecordTypeId'];
    
    for (const rel of relationships) {
      // Skip system-managed relationships
      if (systemRelationships.includes(rel.field_name)) {
        continue;
      }
      
      if (rel.is_required && !data[rel.field_name]) {
        result.valid = false;
        result.errors.push({
          field: rel.field_name,
          message: `Required relationship field '${rel.field_name}' to ${rel.to_sobject} is missing.`,
          type: 'REQUIRED_RELATIONSHIP',
          suggestion: `Create or reference a ${rel.to_sobject} record first`,
        });
      }

      // Warn about lookups that might not exist
      if (data[rel.field_name]) {
        result.suggestions.push({
          field: rel.field_name,
          message: `Ensure ${rel.to_sobject} record with ID '${data[rel.field_name]}' exists.`,
          type: 'REFERENCE_CHECK',
        });
      }
    }
  }

  /**
   * Get a summary of validation results
   */
  getSummary(result: ValidationResult): string {
    const parts: string[] = [];
    
    if (result.valid) {
      parts.push('✅ Validation PASSED');
    } else {
      parts.push('❌ Validation FAILED');
    }

    if (result.errors.length > 0) {
      parts.push(`\n\n❌ Errors (${result.errors.length}):`);
      result.errors.forEach(e => {
        parts.push(`  - ${e.field}: ${e.message}`);
        if (e.suggestion) {
          parts.push(`    💡 ${e.suggestion}`);
        }
      });
    }

    if (result.warnings.length > 0) {
      parts.push(`\n\n⚠️  Warnings (${result.warnings.length}):`);
      result.warnings.forEach(w => {
        parts.push(`  - ${w.field}: ${w.message}`);
      });
    }

    if (result.suggestions.length > 0) {
      parts.push(`\n\n💡 Suggestions (${result.suggestions.length}):`);
      result.suggestions.forEach(s => {
        parts.push(`  - ${s.field}: ${s.message}`);
      });
    }

    return parts.join('\n');
  }
}

/**
 * Validation result structure
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  suggestions: ValidationIssue[];
}

/**
 * Validation issue structure
 */
export interface ValidationIssue {
  field: string;
  message: string;
  type: string;
  suggestion?: string;
  details?: any;
}
