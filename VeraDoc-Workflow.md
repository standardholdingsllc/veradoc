## VeraDoc.pe Revised Workflow

### 1. Account Types

VeraDoc.pe has four account types: Notary, Real Estate Agent, Landlord, and Renter.

The platform is built around the creation, signing, validation, notarial review, certification, storage, and registry tracking of rental lease packets. The core product is not merely electronic signing. The core product is the creation of a structured **Notarial Evidence Packet** that allows a contracted notary to review the evidence and certify signatures based on documented indubitable certainty of authenticity.

The selling point of VeraDoc.pe is that landlords and rentors can complete, sign, and have their contracts notarized in Peru without having to coordinate a notary visit in the middle of the workfday between all parties (including realtor). While the most important function and the product cornerstone is the complete and secure evidence packet, the selling point will always be the convience of secure and legally compliant remotely notarized apartment rental leases. 

---

## 2. Notary Account

The notary is a contracted notary public who receives completed lease packets through the VeraDoc dashboard.

The notary account includes a dashboard showing incoming lease packets organized by status:

Pending review
Needs correction
Rejected
Certified
Certified with observations

When a new packet is submitted, the notary sees the full lease, the final signed PDF, and the structured Notarial Evidence Report attached to that lease.

The notary reviews the evidence packet, including the IOFE digital signature validation, certificate-chain validation, document hash, timestamp, identity evidence, DNI documents, selfie/liveness evidence, WhatsApp OTP verification, consent records, session logs, realtor verification, property metadata, and duplicate-rental registry result.

The notary does not certify because VeraDoc automatically approves the packet. The notary certifies only after personally reviewing the evidence file and determining that there is indubitable certainty of the authenticity of the signatures.

Once satisfied, the notary performs the certification inside the VeraDoc platform and marks the packet complete.

After completion, the notary’s monthly notarized-document count increases by one. This count is used for the notary’s monthly partner payout calculation. VeraDoc collects payment from the realtor and remits the notary’s portion monthly based on completed certified packets.

---

## 3. Real Estate Agent Account

The real estate agent creates and manages lease packets.

The agent account includes a profile with the agent’s DNI, real estate accreditation or license number, personal contact information, real estate firm information, RUC, and business details. This establishes commercial and distribution trust inside the platform.

The realtor logs into the dashboard, creates a new lease packet, uploads the lease agreement, and fills in the required lease metadata. This includes the landlord names, renter names, property address, unit details, rental amount, deposit amount, lease start date, lease expiration date, signer email addresses, signer WhatsApp numbers, and any property registry or supporting ownership information available.

The realtor pays the VeraDoc fee before sending the packet for signing.

Once the packet is created, VeraDoc locks the uploaded lease version and generates a packet ID. VeraDoc also calculates the initial document hash so that the exact lease version can be tracked through the signing and certification process.

The realtor then sends the lease packet to all required signers. Each signer receives a secure signing link.

The realtor can monitor the packet status from the dashboard, including which parties have opened the link, verified their identity, signed, or still need to complete their part.

After all parties complete the signing workflow, VeraDoc generates the Notarial Evidence Report. The realtor is notified that the packet is ready for notarial review.

The realtor then submits the completed packet to the notary through the platform.

After the notary certifies the packet, the realtor receives a notification that the certified lease is complete and available in the account. The realtor can download the final certified lease, view the evidence summary, and access the factura generated for the transaction.

---

## 4. Landlord Account

The landlord account is created during the first signing workflow.

The landlord receives a secure signing link from the VeraDoc packet created by the real estate agent. The landlord opens the link and begins the verification process.

The landlord verifies access through a WhatsApp PIN sent to the declared WhatsApp number. The landlord then creates an account with email and password.

The landlord accepts the data-processing and notarial-submission consent, authorizing VeraDoc to store identity documents, signing evidence, session logs, document evidence, and the final certified lease.

The landlord uploads the front and back of the DNI and completes the selfie/liveness step. VeraDoc records the identity evidence and associates it with the signer’s packet record.

If required, the landlord also provides property-authority evidence, such as property ownership documentation, SUNARP information, a power of attorney, or another document linking the landlord to the property.

The landlord then reviews the lease and signs it through the integrated IOFE-compliant digital signature provider.

After signature, VeraDoc records the signature validation result, certificate-chain validation, timestamp, certificate information, PDF integrity result, and final signed-document hash.

Once the landlord confirms completion, the landlord’s portion of the packet is marked complete.

The landlord can later log into VeraDoc to view the lease, download the final certified document, and access previous lease records.

After the lease reaches its expiration date, the landlord account unlocks the ability to renew or re-sign a lease with the same tenant and same property through the platform, subject to the platform’s renewal rules.

---

## 5. Renter Account

The renter account is also created during the first signing workflow.

The renter receives a secure signing link from the VeraDoc packet created by the real estate agent. The renter opens the link and begins the verification process.

The renter verifies access through a WhatsApp PIN sent to the declared WhatsApp number. The renter then creates an account with email and password.

The renter accepts the data-processing and notarial-submission consent, authorizing VeraDoc to store identity documents, signing evidence, session logs, document evidence, and the final certified lease.

The renter uploads the front and back of the DNI and completes the selfie/liveness step. VeraDoc records the identity evidence and associates it with the signer’s packet record.

The renter then reviews the lease and signs it through the integrated IOFE-compliant digital signature provider.

After signature, VeraDoc records the signature validation result, certificate-chain validation, timestamp, certificate information, PDF integrity result, and final signed-document hash.

Once the renter confirms completion, the renter’s portion of the packet is marked complete.

The renter can later log into VeraDoc to view the lease, download the final certified document, and access previous lease records.

---

## 6. Multiple Signers

The VeraDoc packet supports multiple landlords and multiple renters.

When the real estate agent creates the lease packet, the agent can add all required signers. Each signer receives a separate secure signing link and completes an independent verification, identity, consent, and signature workflow.

The packet is not eligible for notarial submission until all required signers have completed their portion of the process.

Each signer has their own identity evidence, WhatsApp verification, consent record, signature validation, certificate validation, timestamp, and audit trail.

---

## 7. Lease Packet Creation

When the realtor creates a lease packet, VeraDoc creates a unique packet ID and stores the uploaded lease as the initial controlled document version.

VeraDoc records the initial document hash before any signatures occur.

The lease packet includes the lease PDF, transaction metadata, signer list, property metadata, realtor verification data, signer verification status, signature status, audit logs, and notarial review status.

Once the lease is sent for signature, the document version is locked. If the lease document changes, the previous packet version is invalidated and a new signing process must begin.

---

## 8. Signing Workflow

Each signer enters through a unique secure link.

The signer verifies WhatsApp access through a PIN, creates an account, accepts consent, uploads identity evidence, completes selfie/liveness verification, reviews the lease, and signs using the integrated IOFE-compliant digital-signature workflow.

After signing, VeraDoc validates the signature and records the supporting technical evidence.

For each signature, VeraDoc stores the signer identity, certificate subject, certificate issuer, certificate serial number, certificate validity period, certificate-chain result, revocation result if available, timestamp result, signature validation status, and PDF integrity result.

The system also stores device, IP, session, and workflow-event logs for each signer.

---

## 9. Notarial Evidence Report

After all required signers complete the signing workflow, VeraDoc generates a structured Notarial Evidence Report.

The report includes the packet ID, lease metadata, signer list, property information, realtor information, document hash history, IOFE signature validation results, certificate-chain validation results, timestamp evidence, DNI evidence, selfie/liveness evidence, WhatsApp OTP records, consent records, session logs, property-authority evidence, duplicate-rental check result, and any relevant system flags.

This report becomes the notary’s review file.

The purpose of the report is to document the factual and technical grounds supporting the authenticity of the signatures.

---

## 10. Submission to Notary

Once the Notarial Evidence Report is generated, VeraDoc marks the packet as ready for notarial review.

The realtor is notified and submits the completed packet to the notary through the platform.

The notary receives a notification of an incoming packet and sees the packet in the unprocessed or pending-review section of the notary dashboard.

---

## 11. Notary Review

The notary opens the packet and reviews the lease, final signed PDF, and Notarial Evidence Report.

The notary reviews the digital signatures, certificate-chain validation, document integrity proof, timestamp evidence, identity evidence, signer consent records, session logs, realtor verification, property information, and duplicate-rental registry result.

The notary completes a review checklist inside the platform confirming the reviewed evidence.

The notary then decides whether the evidence supports indubitable certainty of the authenticity of the signatures.

If satisfied, the notary certifies the signatures inside the VeraDoc platform.

If not satisfied, the notary can return the packet for correction or reject the packet.

---

## 12. Certification Completion

Once the notary certifies the packet, VeraDoc marks the packet as certified.

The final certified lease is stored in the platform.

The realtor, landlord, renter, and any other authorized signers are notified by email that the certified lease is complete and available in their accounts.

Each party can log into VeraDoc to view and download the final certified lease.

The realtor’s factura is generated and made available in the realtor account.

The notary’s completed-document count increases by one for the monthly payout calculation.

---

## 13. Lease Registry

After certification, VeraDoc creates or updates a registry entry for the leased property.

The registry entry includes the property address, unit details, lease start date, lease expiration date, landlord identity, renter identity, realtor identity, packet ID, and certification status.

The registry is used to detect whether the same property appears to be rented again before the current lease expiration date.

If a new lease packet is later created for the same property while an active lease exists, VeraDoc displays warnings and verification flags.

The registry does not hard-lock the property. It soft-prevents duplicate-rental fraud by warning the realtor, signers, VeraDoc, and notary that the property appears to have an active lease.

---

## 14. Post-Certification Access

After certification, all parties retain access to the final certified lease through their VeraDoc accounts.

The realtor can view completed packets, invoices, signer status history, and certified documents.

The landlord can view current and past leases and, after expiration, access eligible renewal tools.

The renter can view current and past leases and download the final certified document.

The notary can view completed certifications, monthly counts, payout history, and prior evidence packets associated with completed notarizations.

---

## 15. Renewal Workflow

After a lease reaches its expiration date, VeraDoc unlocks renewal functionality for the landlord account.

The landlord can initiate a renewal with the same renter and same property without requiring a new realtor-created packet.

The renewal process creates a new lease packet, requires updated signer consent, requires the landlord and renter to complete the signing workflow again, and produces a new Notarial Evidence Report for notarial review.

The renewal packet follows the same signing, evidence, notary review, certification, storage, factura, and registry-update process as the original lease.
