# BuildRight Logistics - Low Level Artifact Catalog

This document translates the HLD into executable low-level artifacts and step-wise implementation controls.

## 1) Salesforce Object and Field Artifacts

## 1.1 Standard Objects

### Account

- `ERP_Customer_ID__c` (Text, External ID, Unique, Indexed)
- `Customer_Type__c` (Picklist: Developer, Agency, Government Contractor)
- `Data_Quality_Score__c` (Number)
- `Golden_Record_Flag__c` (Checkbox)

### Opportunity (Proposal)

- `Client_Type__c` (Picklist: Commercial, Government)
- `Region__c` (Picklist)
- `Final_Landed_Cost__c` (Currency)
- `Cost_Status__c` (Picklist: Pending, Received, Failed)
- `Migration_Batch_ID__c` (Text, Indexed)

### OpportunityLineItem

- `Floor_Price__c` (Formula or copied value from PBE)
- `Price_Compliance_Status__c` (Picklist)

### Case

- `Fleet_Truck_ID__c` (Text, Indexed)
- `Fleet_Status_Last_Refreshed__c` (Datetime)

## 1.2 Custom Objects

### Site__c (recommended)

- `Site_External_ID__c` (Text, External ID)
- `Geo_Lat__c`, `Geo_Long__c`
- `Road_Category__c`

### Site_Accessibility_Audit__c

- `Opportunity__c` (Master-Detail)
- `Site__c` (Lookup)
- `Audit_External_ID__c` (Text, External ID, Unique in migration stage)
- `Audit_Status__c` (Picklist: Draft, Verified, Final)
- `Has_Transaction_Info__c` (Checkbox)
- `Dedup_Score__c` (Number)
- `Superseded_By__c` (Lookup to Site_Accessibility_Audit__c)

### Agency_Developer_Mapping__c

- `Agency_Account__c` (Lookup Account)
- `Developer_Account__c` (Lookup Account)
- `Mapping_Status__c` (Active/Inactive)
- `Effective_From__c`, `Effective_To__c`

## 1.3 External Objects

### Historical_Proposal__x

- `External_Proposal_ID__c` (primary key)
- `Developer_Account_Key__c` (for indirect lookup)
- `Proposal_Date__c`
- `Proposal_Value__c`

---

## 2) Identity and Access Artifacts

## 2.1 Auth Protocol Mapping

- Internal users: SAML 2.0 Azure AD app
- External portal users: OIDC provider config on Experience Cloud
- Social federation: Azure AD B2C/B2B policy with Google/Microsoft

## 2.2 Permission Model

- Permission Set Groups:
  - `PSG_Sales_Core`
  - `PSG_Service_Core`
  - `PSG_Logistics_Audit`
  - `PSG_Gov_Compliance`
  - `PSG_Agency_External`

## 2.3 Restriction Rule Artifact

- Object: Opportunity
- Condition: `Client_Type__c = 'Government'`
- Applies to: all except compliance group users and manager scope (through role/public group strategy).

---

## 3) Sharing Artifacts

## 3.1 OWD Baseline

- Account: Private
- Opportunity: Private
- Case: Private
- Site_Accessibility_Audit__c: Controlled by Parent

## 3.2 Apex Managed Sharing Job

Nightly + on-change job:

1. Read active `Agency_Developer_Mapping__c` records.
2. Resolve eligible Opportunities for mapped developer accounts.
3. Upsert `OpportunityShare` rows for agency users/groups.
4. Remove stale share rows where mapping expired.

## 3.3 Service Territory Visibility

- Criteria-based sharing on Case by territory.
- Managers inherit by role hierarchy.

---

## 4) Deduplication Artifacts

## 4.1 Account Dedup Rules

Matching keys:

- Tax ID exact
- normalized legal name + phone
- normalized domain + billing country

Survivorship scoring:

- has tax id (+40),
- has active opportunities (+25),
- latest modified date (+15),
- data completeness index (+20).

## 4.2 Proposal Dedup Rules

Potential duplicate hash:

- `(Account_Golden_ID + Project_Name_Normalized + Proposal_Date_Window + Amount_Bucket + CurrencyIsoCode)`.

Action:

- auto-block high-confidence duplicates,
- queue medium-confidence for data steward review.

## 4.3 Audit Dedup Logic (for "5 audits keep 2 with transactions" case)

```text
Group by: Opportunity + Site + Audit Window + Inspector
Keep all records where Has_Transaction_Info__c = true
From remaining non-transaction records:
  score = completeness + evidence + approval + recency
  keep highest-scored record
Mark others as superseded
```

---

## 5) Integration Artifacts

## 5.1 Proposal Won Event Contract

Event: `Proposal_Won__e`

- `OpportunityId__c`
- `AccountERPId__c`
- `CorrelationId__c`
- `EventVersion__c`
- `OccurredAt__c`

## 5.2 AX Callback API

Endpoint: `/services/apexrest/proposalcostsync`

Payload:

```json
{
  "correlationId": "uuid",
  "opportunityId": "006...",
  "finalLandedCost": 145000.75,
  "currencyIsoCode": "AED",
  "status": "SUCCESS"
}
```

Idempotency key:

- `correlationId + opportunityId`

## 5.3 Fleet UI Mashup

- LWC -> Apex service -> Named Credential callout
- Cache key: `fleet:{truckId}`
- TTL: 10 minutes
- Data stored: transient cache + optional status timestamp only

## 5.4 Azure Data Lake Virtualization

- External data source (OData 4.0)
- External object mapping
- Indirect lookup on Account external id
- Search indexing strategy for high-use fields

---

## 6) LDV Artifacts

## 6.1 Required Index Candidates

- Account: `ERP_Customer_ID__c`
- Opportunity: `Region__c`, `StageName`, `CloseDate`, `Migration_Batch_ID__c`
- Site_Accessibility_Audit__c: `Opportunity__c`, `Audit_Status__c`, `Site__c`
- Case: `Fleet_Truck_ID__c`, `Territory__c`

## 6.2 Batch and Async Patterns

- Batch Apex for share recalculation and archive staging.
- Queueable/Platform Events for heavy downstream integrations.
- Avoid trigger-based large fan-out operations.

## 6.3 Archive Policy

- Closed proposals older than 24 months moved to Azure Data Lake.
- Keep summary projection in Salesforce (optional compact custom object).

---

## 7) Migration Artifacts

## 7.1 Migration Wave Plan

1. Identity and security metadata
2. Accounts + contacts (golden records only)
3. Opportunities
4. OLIs
5. Audits
6. Cases

## 7.2 Migration Controls

- Custom setting `Bypass_Automations__c`
- Trigger framework checks bypass flag before callouts/events
- Retry queue for failed records with row-level error codes
- Reconciliation report by object and parent-child linkage

## 7.3 Migration 2.0 Artifacts

- Delta extractor jobs for in-flight transactions
- Business review queue for unresolved duplicate clusters
- Post-go-live cleanse backlog
- Controlled re-enable of automations in sequence

---

## 8) Security Artifacts

- Shield encryption policy matrix for PII/pricing fields
- Event Monitoring dashboards:
  - bulk export attempts,
  - suspicious login geolocation,
  - API abuse from external users
- Transaction security policy:
  - block high-volume report export for non-compliance users

---

## 9) Deployment Runbook

## 9.1 Branch and Review Gates

- Feature branch -> PR -> static checks -> integration deploy
- Mandatory reviewers: technical lead + security reviewer for sensitive changes

## 9.2 Environment Promotion Steps

1. Dev build + unit test
2. Integration sandbox deploy + contract test
3. UAT full-copy deploy + business signoff
4. Production deploy window
5. Post-deploy smoke + data/access validation

## 9.3 Rollback Readiness

- metadata backup package per release,
- reversible permission set changes,
- feature toggles for integrations,
- clear incident command steps.

---

## 10) Open Design Decisions (for workshop closure)

- final choice of middleware tool (MuleSoft vs enterprise standard iPaaS),
- whether to materialize a compact historical summary object in Salesforce,
- Site__c Phase 1 vs Phase 2 timing decision,
- final legal retention period by region (US vs Middle East regulations).
