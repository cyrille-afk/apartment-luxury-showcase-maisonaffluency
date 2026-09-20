/**
 * Baseline GDPR Article 28 Data Processing Agreement.
 *
 * This is our standard contractual terms for any supplier processing personal
 * data on our behalf. It is kept as plain Markdown so the legal desk can read
 * it on `/compliance/dpa-template`, export it, and negotiate from a single
 * versioned source.
 */
export const DPA_TEMPLATE_VERSION = "1.0";
export const DPA_TEMPLATE_EFFECTIVE = "20 September 2026";

export const DPA_TEMPLATE_MARKDOWN = `# Data Processing Agreement

**Baseline supplier terms — GDPR Article 28**
Version ${DPA_TEMPLATE_VERSION} · Effective ${DPA_TEMPLATE_EFFECTIVE}

This Data Processing Agreement ("DPA") forms part of the agreement between:

**(1) Maison Affluency Pte. Ltd.**, a company incorporated in Singapore (the "Controller"); and

**(2) [SUPPLIER LEGAL NAME]**, of [REGISTERED ADDRESS] (the "Processor"),

each a "Party" and together the "Parties".

---

## 1. Definitions

1.1 "Applicable Data Protection Law" means Regulation (EU) 2016/679 (the "GDPR"), the UK GDPR and the Data Protection Act 2018, the Singapore Personal Data Protection Act 2012, and any other data-protection legislation applicable to the processing.

1.2 "Personal Data", "processing", "data subject", "controller", "processor", "sub-processor", "supervisory authority" and "personal data breach" bear the meanings given in the GDPR.

1.3 "Services" means the services described in the Principal Agreement between the Parties.

1.4 "Sub-processor" means any third party engaged by the Processor to process Personal Data on the Controller's behalf.

---

## 2. Subject matter and role of the Parties

2.1 The Processor processes Personal Data only as a processor acting on the Controller's behalf, and solely to deliver the Services.

2.2 The subject matter, duration, nature and purpose of the processing, the types of Personal Data and the categories of data subjects are set out in **Annex I**.

2.3 Nothing in this DPA authorises the Processor to act as an independent controller of the Personal Data, nor to use it for its own purposes, product development, profiling, advertising, or the training of machine-learning models.

---

## 3. Processor obligations (Article 28(3))

The Processor shall:

3.1 **Documented instructions.** Process Personal Data only on the Controller's documented instructions, including regarding transfers to a third country, unless required otherwise by Union or Member State law, in which case it shall inform the Controller before processing unless that law prohibits such notice.

3.2 **Confidentiality.** Ensure that every person authorised to process Personal Data is bound by an enforceable duty of confidentiality that survives the end of their engagement.

3.3 **Security.** Implement and maintain the technical and organisational measures described in **Annex II**, appropriate to the risk, including pseudonymisation and encryption where appropriate, resilience of processing systems, restoration of availability after an incident, and regular testing of effectiveness.

3.4 **Sub-processors.** Not engage a Sub-processor without the Controller's prior specific or general written authorisation, and give at least **thirty (30) days'** notice of any intended addition or replacement, during which the Controller may object on reasonable data-protection grounds. Where a Sub-processor is engaged, the Processor shall impose materially the same obligations as those in this DPA by written contract, and remains fully liable to the Controller for the Sub-processor's performance.

3.5 **Assistance with data-subject rights.** Taking into account the nature of the processing, assist the Controller by appropriate technical and organisational measures in fulfilling requests to exercise rights under Chapter III of the GDPR, and notify the Controller **without undue delay and in any event within five (5) business days** of receiving such a request directly.

3.6 **Assistance with Articles 32 to 36.** Assist the Controller in ensuring compliance with the obligations on security of processing, breach notification, data-protection impact assessments and prior consultation, taking into account the nature of processing and the information available to it.

3.7 **Breach notification.** Notify the Controller **without undue delay and in any event within twenty-four (24) hours** of becoming aware of a personal data breach, providing the nature of the breach, the categories and approximate number of data subjects and records concerned, the likely consequences, the measures taken or proposed, and a contact point for further information.

3.8 **Deletion or return.** At the Controller's election, delete or return all Personal Data at the end of the provision of the Services, and delete existing copies unless Union or Member State law requires storage. The Processor shall certify deletion in writing within **thirty (30) days** of the Controller's request.

3.9 **Audit and information.** Make available to the Controller all information necessary to demonstrate compliance with Article 28, and allow for and contribute to audits, including inspections, conducted by the Controller or an auditor it mandates, no more than once per year save following a personal data breach or at a supervisory authority's direction. Current SOC 2 Type II or ISO/IEC 27001 reports may be provided to satisfy this obligation in the first instance.

3.10 **Unlawful instructions.** Immediately inform the Controller if, in its opinion, an instruction infringes Applicable Data Protection Law.

---

## 4. International transfers

4.1 The Processor shall not transfer Personal Data outside the European Economic Area, the United Kingdom or Switzerland unless an appropriate transfer mechanism is in place, being one of: an adequacy decision; the EU Standard Contractual Clauses (Commission Implementing Decision (EU) 2021/914), Module Two or Module Three as applicable; the UK International Data Transfer Addendum; or the Processor's active certification under the EU-US Data Privacy Framework and its UK extension.

4.2 Where the Standard Contractual Clauses apply, they are incorporated into this DPA by reference, with the Controller as data exporter and the Processor as data importer; Annexes I and II of this DPA populate the corresponding annexes of those Clauses; the governing law is that of Ireland and the competent courts are those of Ireland, save where another Member State's law is mandatory.

4.3 The Processor shall notify the Controller promptly if a transfer mechanism it relies upon is invalidated or its certification lapses, and shall cooperate in adopting an alternative mechanism or suspending transfers.

4.4 **Government access.** The Processor shall notify the Controller of any legally binding request from a public authority for disclosure of Personal Data, unless prohibited by law, shall challenge requests that appear unlawful, and shall disclose only the minimum lawfully required.

---

## 5. Records, personnel and data minimisation

5.1 The Processor shall maintain a record of all categories of processing carried out on the Controller's behalf, as required by Article 30(2), and make it available on request.

5.2 Access to Personal Data shall be restricted to personnel who require it to deliver the Services, subject to role-based access control and multi-factor authentication.

5.3 The Processor shall not retain Personal Data for longer than needed to deliver the Services or comply with law, and shall apply the retention periods set out in Annex I.

---

## 6. Liability, term and general

6.1 This DPA takes effect on the date of the Principal Agreement and continues for as long as the Processor processes Personal Data on the Controller's behalf.

6.2 Clauses 3.7, 3.8, 3.9 and 4 survive termination.

6.3 In the event of conflict, this DPA prevails over the Principal Agreement in respect of data protection, and the Standard Contractual Clauses prevail over this DPA.

6.4 Liability is governed by the Principal Agreement, save that no limitation shall exclude liability that cannot lawfully be limited, including regulatory fines and data-subject compensation arising from the Processor's breach.

6.5 This DPA is governed by the law stated in the Principal Agreement, without prejudice to clause 4.2.

---

## Annex I — Description of processing

| Item | Detail |
| --- | --- |
| Categories of data subjects | [e.g. trade account holders, private clients, prospective clients, internal staff] |
| Categories of Personal Data | [e.g. name, email, telephone, billing and delivery address, company registration and tax identifiers, order and quote history, uploaded credential documents] |
| Special category data | [None, unless expressly stated] |
| Nature and purpose | [e.g. payment processing, transactional email delivery, application hosting] |
| Duration of processing | For the term of the Principal Agreement plus the retention period stated below |
| Retention | [e.g. 90 days after termination, then permanent deletion] |
| Frequency of transfer | Continuous |

---

## Annex II — Technical and organisational measures

1. Encryption of Personal Data in transit (TLS 1.2 or higher) and at rest (AES-256 or equivalent).
2. Role-based access control, least-privilege provisioning, and multi-factor authentication for all administrative access.
3. Segregation of production data from development and test environments; no production Personal Data in non-production environments.
4. Logging and monitoring of access to Personal Data, with tamper-resistant audit trails retained for at least twelve months.
5. Vulnerability management, patching within defined severity-based timeframes, and annual penetration testing.
6. Documented incident response and breach notification procedures, tested at least annually.
7. Backup and disaster recovery with defined recovery point and recovery time objectives, tested at least annually.
8. Secure deletion and media sanitisation on decommissioning.
9. Personnel screening, confidentiality undertakings, and annual data-protection training.
10. Vendor due diligence for onward Sub-processors, including a security and data-protection assessment before engagement.

---

## Annex III — Authorised Sub-processors

| Sub-processor | Service | Country of processing | Transfer mechanism |
| --- | --- | --- | --- |
| [Name] | [Service] | [Country] | [Mechanism] |

---

## Signatures

**For Maison Affluency Pte. Ltd.**
Name: ______________________ Title: ______________________
Signature: __________________ Date: ______________________

**For the Processor**
Name: ______________________ Title: ______________________
Signature: __________________ Date: ______________________
`;
