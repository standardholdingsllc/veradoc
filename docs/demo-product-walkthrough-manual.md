# VeraDoc Demo Product Walkthrough Manual

## Purpose

This manual is for the person presenting VeraDoc to the internal team at a notary partner. It explains exactly what to prepare, what the demo can prove, how to walk through every major surface, what to say while doing it, and where to stop so the audience does not confuse a synthetic demonstration with a production certification workflow.

The intended audience is a notary-partner team evaluating the product concept and the shape of the operational workflow. The intended presenter is someone who can operate the demo, move between realtor, signer, party, registry, and notary views, and answer questions about what is simulated.

This is a presenter runbook, not a production readiness approval. It should be used alongside the subdomain transition constraints in [`SUBDOMAIN_TRANSITION_AGENT_GUIDE.md`](../SUBDOMAIN_TRANSITION_AGENT_GUIDE.md).

## Executive readiness decision

The demo is suitable for a controlled internal walkthrough if it is presented as a shared, temporary workspace containing only synthetic data. Confirm the public deployment is running this version before the meeting.

It is not suitable to present as a live end-to-end operating environment if the notary partner expects any of the following to be real during the meeting:

- production email or WhatsApp delivery;
- resend, retry, delivery, bounce, or notification history;
- real account creation, login, password enforcement, or cross-subdomain sessions;
- real document upload, storage, download, or PDF inspection;
- real payment processing;
- real identity verification, liveness, or DNI validation;
- a real IOFE provider redirect or certificate operation;
- a real notarial seal, legal certification, or registry submission;
- synchronization outside the same demo workspace or after the workspace expires;
- durable production records that remain after demo data is reset.

The correct positioning is:

> “This is a synthetic walkthrough of the intended VeraDoc workflow. A temporary demo workspace can be shared across devices with its access links. The evidence, identity, signature, payment, registry, and notification results shown here are simulated.”

If the partner’s objective is specifically to validate real notification delivery or a real notary operating process, pause before the meeting and treat the provider-backed integration work as a separate readiness gate. Do not use this demo as evidence that those integrations are already operating.

## What the demo currently demonstrates

Within one temporary demo workspace, the demo can walk through:

1. choosing a role;
2. creating a lease packet as an inmobiliario agent;
3. simulating document upload and displaying an initial hash;
4. entering lease and signer data;
5. simulating payment confirmation;
6. generating signer links scoped to the temporary workspace;
7. opening a signer flow;
8. verifying the fixed demo OTP;
9. creating a simulated signer account;
10. recording simulated consent;
11. simulating DNI-front, DNI-back, and selfie/liveness uploads;
12. reviewing a twelve-page placeholder lease preview;
13. simulating a digital signature result;
14. inspecting signer progress and packet status from the realtor view;
15. generating a synthetic evidence report;
16. submitting the packet to the demo notary queue;
17. inspecting the evidence sections available to the notary;
18. completing a notary checklist;
19. recording a simulated property-authority result and approving evidence for the pending-seal stage, or returning or rejecting the packet;
20. inspecting registry results and a duplicate-address warning;
21. showing landlord and renter contract views;
22. completing four simulated certification steps, publishing to the parties, and showing a simulated certified-document download and renewal affordance.

The demo banner says `Modo demostración — datos simulados`. Keep it visible and use it as the first visual reminder to the audience.

For a signer resumption scenario, use seeded `PKT-2024-001`: the landlord is complete while the renter has stopped after identity upload. Open the renter’s generated link, show that the flow resumes from its recorded step, then return to the realtor dashboard to show signer progress. Do not reuse a link after resetting the workspace.

## What the demo does not do

The following statements must remain true throughout the presentation:

- `Enviar enlaces de firma` creates workspace links. Any configured demo email is restricted to an approved safe recipient; it does not send production messages or WhatsApp/SMS.
- `Enviar recordatorio` produces a demo success toast. It does not contact a signer and does not create a provider delivery record.
- The signer OTP is always `123456` in the demo.
- The signer account form records simulated progress in the workspace. It does not create a real authentication account or session.
- The identity cards are clickable simulations. No image is uploaded and no identity provider is called.
- The signing screen describes a redirect to an IOFE provider, but the demo completes locally after a short simulated processing delay.
- Payment displays demo values and uses a placeholder method. It does not charge a card or connect to a payment provider.
- Registry records, property evidence, hashes, certificate details, audit events, and notary outputs are sample data or generated in the temporary demo workspace.
- `Descargar contrato` and `Descargar contrato certificado` show a simulated download confirmation. They do not deliver a production document file.
- The demo workspace is saved through demo APIs and refreshed across sessions. Only share its presenter, notary, and signer links with intended participants.
- Workspace reset and expiry remove synthetic demo state; they do not affect production records.

## Recommended meeting format

For a first notary-partner walkthrough, reserve 25–35 minutes:

| Segment | Time | Outcome |
|---|---:|---|
| Framing and limitations | 2–3 min | Everyone understands that this is synthetic demo state |
| Role selection and realtor packet creation | 5–7 min | The partner sees how an expediente begins |
| Signer flow | 6–8 min | The partner sees the remote party experience |
| Realtor evidence and registry | 3–4 min | The partner sees how signer activity becomes a review package |
| Notary queue and evidence review | 7–10 min | The partner sees the review surface and checklist |
| Decision outcomes and discussion | 5–8 min | The partner gives feedback on evidence, controls, and operating model |

If the meeting is shorter than 20 minutes, use the fast path described in [Fast path: notary review](#fast-path-notary-review). If the partner wants to inspect the signer experience deeply, omit the preloaded exception paths and preserve time for the full signing flow.

## Before the meeting

### 1. Confirm the correct host

Use the clean public demo host:

```text
https://demo.veradoc.pe/
```

Use clean routes such as:

```text
https://demo.veradoc.pe/agente
https://demo.veradoc.pe/notario
https://demo.veradoc.pe/registro
```

Do not make the internal route prefix part of the walkthrough. A path such as `/demo/agente` is an internal compatibility route and redirects to `/agente`; use the clean URL in presentation materials and browser bookmarks.

Do not use `app.veradoc.pe`, `notario.veradoc.pe`, or `admin.veradoc.pe` as substitutes for the demo host. Those are separate surfaces with separate authentication and operational expectations.

### 2. Use a controlled browser profile

Recommended setup:

- one Chromium-based desktop browser at 100% zoom;
- a clean profile or private window for the presenter;
- a second private window only if you need to demonstrate that the signer link opens as a separate page;
- browser notifications and personal mail tabs closed;
- no real identity documents, customer data, personal phone numbers, or personal email addresses entered;
- developer tools closed before screen sharing;
- a stable internet connection, because the workspace is saved through demo APIs;
- a screen large enough to show the wide notary evidence table and left-hand navigation.

The signer flow has a clean layout without the dashboard shell. Use its generated signer link to demonstrate progress on another device within the same workspace.

### 3. Decide which path to use

Use one of these paths before the meeting:

| Path | Best for | State required |
|---|---|---|
| Full synthetic path | Showing the whole intended lifecycle | Create a new packet, use at least one signer flow, then use the presenter shortcut for the remaining signer if time is limited |
| Fast notary path | A notary team primarily interested in evidence review | Open `PKT-2024-002`, which is already `Listo para notario` |
| Exception path | Discussing duplicate detection and review outcomes | Open `PKT-2024-003` for the duplicate warning, `PKT-2024-005` for correction, or `PKT-2024-006` for certification with observations |
| Certified-party path | Showing post-certification access | Open the direct detail route for `PKT-2024-004` or `PKT-2024-006` from the seeded state |

For the first partner meeting, use the full synthetic path for the first half and the seeded fast path as a backup. The seeded records are deliberately varied, so they are useful if a live-created packet becomes awkward during the meeting.

### 4. Reset only the demo workspace when needed

Use the demo workspace reset control available to the presenter, or start a fresh workspace through the demo entry route. A reset invalidates the current workspace links, so generate new notary and signer links before continuing. Do not try to reset the demo by clearing `localStorage`.

### 5. Run the five-minute preflight

Complete this check before the partner joins:

- [ ] `https://demo.veradoc.pe/` loads and shows `Modo demostración — datos simulados`.
- [ ] The four role cards appear: `Agente inmobiliario`, `Arrendador`, `Arrendatario`, and `Notario`.
- [ ] `/agente` loads the realtor dashboard.
- [ ] `/notario` loads the notary dashboard.
- [ ] `/notario/historial` and `/notario/perfil` load, and the pending-seal tab is visible.
- [ ] `/registro` loads the registry page.
- [ ] The seeded notary queue contains at least one item in `Pendientes de revisión`.
- [ ] `PKT-2024-002` opens at `/notario/paquetes/pkt-2024-002`.
- [ ] The OTP screen displays the instruction to use `123456` for the demonstration.
- [ ] The demo workspace is either intentionally clean or intentionally prepared for the selected path.
- [ ] The notary and signer links point to the same temporary workspace.
- [ ] No real person’s information is visible in the browser or in a prepared note.
- [ ] The presenter has copied this manual or the quick-reference routes below into a private note.

## Quick reference: route map

The application UI is in Spanish; the route names are short and stable.

| Surface | Clean route | Purpose |
|---|---|---|
| Role selector | `/` | Enter a role-specific demo view |
| Realtor dashboard | `/agente` | Packet counts and entry point to packet creation |
| New packet | `/agente/nuevo-paquete` | Six-step packet wizard |
| Realtor packet list | `/agente/paquetes` | Find packet codes and statuses |
| Realtor packet detail | `/agente/paquetes/[packetId]` | Status, signer progress, evidence, and packet actions |
| Registry | `/registro` | Search demo registry records and duplicate warnings |
| Landlord dashboard | `/arrendador` | Landlord-facing contract view |
| Landlord contracts | `/arrendador/contratos` | Landlord contract history |
| Landlord contract detail | `/arrendador/contratos/[packetId]` | Evidence, download simulation, renewal if available |
| Renter dashboard | `/arrendatario` | Renter-facing contract view |
| Renter contracts | `/arrendatario/contratos` | Renter contract history |
| Renter contract detail | `/arrendatario/contratos/[packetId]` | Evidence and download simulation |
| Notary dashboard | `/notario` | Review queue, metrics, and status tabs |
| Notary queue compatibility route | `/notario/cola` | Redirects to `/notario` |
| Notary evidence review | `/notario/paquetes/[packetId]` | Evidence sections, checklist, and decision panel |
| Signer opening page | `/firma/[token]` | Start or resume a signer flow |
| Signer OTP | `/firma/[token]/verificar` | Enter the fixed demo OTP |
| Signer account | `/firma/[token]/crear-cuenta` | Simulated account-creation step |
| Signer consent | `/firma/[token]/consentimiento` | Record simulated informed consent |
| Signer identity | `/firma/[token]/identidad` | Simulated DNI and liveness steps |
| Signer review | `/firma/[token]/revision` | Review placeholder lease and acknowledge it |
| Signer signing | `/firma/[token]/firmar` | Simulated digital signature |
| Signer completed | `/firma/[token]/completado` | Confirmation that the signer flow is complete |

## Recommended full walkthrough

### Opening statement: set the frame before clicking

Say something close to the following:

> “I’ll show the intended flow from the agent creating a controlled lease packet, through the remote signer experience, into the notary evidence queue. The banner marks this as demo mode. The records and controls are synthetic, so today we are evaluating the workflow, evidence organization, and review experience—not claiming that messages, identity checks, payment, or notarial certification are being executed against live providers.”

Ask the notary team to focus on three questions:

1. Is the evidence organized in the order a notary would actually review it?
2. Are the decision controls and exception paths clear enough for a real operating team?
3. Which parts would require policy, legal, provider, or operational approval before adoption?

### Part 1 — Enter the demo and select a role

1. Open `https://demo.veradoc.pe/`.
2. Point out the four role cards.
3. Explain that selecting a role changes the demo persona and opens the corresponding surface; it does not authenticate a real user.
4. Click `Entrar` under `Agente inmobiliario`.
5. Point out the `Modo demostración — datos simulados` banner and the left navigation.

Presenter note: navigating directly to `/agente`, `/notario`, `/arrendador`, or `/arrendatario` also changes the visible role shell. The demo is not asking the presenter to enter production credentials.

### Part 2 — Show the realtor dashboard

On `/agente`, show:

- the packet summary cards;
- the packet list entry point;
- `Nuevo paquete` in the sidebar;
- `Paquetes` for existing records;
- `Registro` for registry inspection.

Suggested explanation:

> “The agent’s responsibility is to create a controlled packet, identify the parties, send them into the remote signing flow, and submit a complete evidence package to a participating notary. The notary remains the reviewing authority in the intended operating model.”

Click `Nuevo paquete`.

### Part 3 — Create a packet in the six-step wizard

The wizard has six steps. Use the prefilled synthetic values unless the partner asks to test a different field.

#### Step 1: `Cargar contrato`

1. Click `Subir contrato`.
2. Let the progress animation finish.
3. Confirm that the UI shows:

   - file name `contrato-arrendamiento-2024.pdf`;
   - status `Cargado`;
   - an initial SHA-256 display beginning with the demo hash `e3b0c442...`.

4. Explain that this is an upload interaction and hash presentation only. No PDF is being uploaded to production storage.
5. Click the bottom navigation control to continue.

What to say:

> “The important product question here is whether the document becomes a controlled version with an identifiable hash before the parties start. The current demo shows that state transition with fixed sample data.”

#### Step 2: `Datos del contrato`

The prefilled sample values are:

| Field shown in UI | Demo value |
|---|---|
| `Dirección del inmueble` | `Av. Larco 345` |
| `Unidad/Departamento` | `Dept. 4B` |
| `Distrito` | `Miraflores` |
| `Provincia` | `Lima` |
| `Departamento` | `Lima` |
| `Renta mensual` | `2800` |
| `Depósito` | `5600` |
| `Moneda` | `PEN` |
| `Fecha de inicio` | `2024-06-01` |
| `Fecha de vencimiento` | `2026-05-31` |
| `Tipo de uso` | `Vivienda` |
| `Notas` | `Contrato de arrendamiento — renovación anual` |

1. Point out that `Provincia`, `Departamento`, and `Moneda` are read-only in this demo form.
2. Leave `Distrito` as `Miraflores`, unless you want to demonstrate the available choices: Miraflores, San Isidro, Barranco, Surco, Jesús María, and La Molina.
3. Explain that the required progression check currently depends on address, district, monthly rent, start date, and expiration date.
4. Click the continue arrow.

#### Step 3: `Agregar firmantes`

Two fictional signers are prefilled:

| Role | Name | Email | WhatsApp | DNI |
|---|---|---|---|---|
| `Arrendador` | María Elena Vargas Torres | `maria.vargas@email.com` | `+51987654321` | `00456789` |
| `Arrendatario` | Carlos Alberto Mendoza Ruiz | `carlos.mendoza@email.com` | `+51912345678` | `00876543` |

1. Show the fields `Nombre completo`, `Correo electrónico`, `WhatsApp`, `DNI`, and `Rol en el contrato`.
2. Emphasize that the demo DNI values are fictional, eight-digit values in the non-issued range.
3. If asked about adding more people, click `Agregar firmante` and show that another signer card is created. Remove it before continuing if it is not needed.
4. Explain that the UI requires a name, email, and eight-digit DNI for each signer before advancing.
5. Click the continue arrow.

Do not enter a real partner employee’s DNI, phone number, or email address. The demo’s data is designed to remain synthetic.

#### Step 4: `Revisar paquete`

Use this step to pause and narrate the packet boundary.

Show:

- property and lease values;
- the signer list and roles;
- `contrato-arrendamiento-2024.pdf`;
- the initial hash display;
- the warning `Una vez creado, la versión del documento queda bloqueada.`

Suggested explanation:

> “This is the last review point before the packet is created. The intended control is that the packet has a known document version and known parties before payment and signing are initiated.”

Click the continue arrow.

#### Step 5: `Pago`

1. Point out `Tarifa VeraDoc` and the demo amount of `S/ 199.00` or the equivalent localized currency display.
2. Explain that the amount is a UI value and the payment confirmation is simulated.
3. Click `Pagar y crear paquete`.
4. Wait for the success toast `Pago confirmado`.

This creates a packet in the temporary demo workspace and advances the wizard to the link step. The packet receives a generated packet ID and synthetic signer tokens.

Required wording:

> “The packet is now created in demo state. This is not a card charge and no payment provider has been contacted.”

#### Step 6: `Enviar enlaces`

1. Show the signer names, roles, and the relative links beginning with `/firma/`.
2. Click the copy icon for one link if you want to demonstrate link handling.
3. Click `Enviar enlaces de firma`.
4. Wait for the toast `Enlaces de firma enviados`.
5. Open one generated signer link in a separate browser or device to demonstrate shared workspace progress.

The links are the best handoff into the signer flow. The demo can also send them to its approved sandbox inboxes when that feature is configured. A production signing link and its delivery controls require separate verification.

If someone asks whether the email was sent, check the result shown by the demo. Sandbox delivery, when configured, is limited to approved demo inboxes. Do not describe that result as delivery to a production signer. The reminder control remains a UI simulation.

### Part 4 — Walk through the signer experience

Use one signer link and complete it fully. There is no need to complete both signers manually during the meeting.

#### Signer opening: `Firma de contrato`

1. Open the generated `/firma/[token]` link.
2. Show the property address, agent, signer name, and lease dates.
3. Point out the progress indicator and the `Proceso seguro de verificación` presentation.
4. Click `Comenzar verificación`.

The opening page may resume at a later step if that signer has already advanced. This is expected behavior for the shared demo workspace.

#### Step 1: `Verificación WhatsApp`

1. Show the message that a code was sent to WhatsApp.
2. Enter `123456` in `Ingrese el código de 6 dígitos`.
3. Click `Verificar código`.
4. Confirm the `Verificación exitosa` toast.

Say:

> “The product concept includes a channel verification step before the signer continues. In this demo, the code is fixed and no WhatsApp message is actually sent.”

To show an error state, enter any six digits other than `123456`, submit, and then replace them with the demo code. Do this only if the audience wants to inspect validation behavior.

#### Step 2: `Crear cuenta`

The email is read-only and comes from the signer’s demo link. Use a synthetic password such as:

```text
Contraseña: Demo1234!
Confirmar contraseña: Demo1234!
```

1. Check the email shown and fill the two password fields.
2. Click `Continuar`.
3. Explain that the form demonstrates the intended point in the journey where a signer account would be established.

The demo checks the same minimum length and matching rule as the current product form, but does not create a real account or authenticate a session. The password stays in the browser form and is not sent as a demo account credential. Do not use a real password.

#### Step 3: `Consentimiento informado`

1. Read the consent summary only at a high level unless the partner asks for the exact language.
2. Point out that the checkbox records consent to data processing and notarial presentation in the synthetic flow.
3. Show the visible `demo-v1` text version; the accepted version is stored with the simulated signer state.
4. Check `Acepto los términos de procesamiento de datos y presentación notarial`.
5. Click `Continuar`.

Suggested explanation:

> “The important review question is not only whether consent is collected, but whether the final evidence package can show what was accepted, when it was accepted, and in which session. The seeded records display those evidence fields.”

#### Step 4: `Verificación de identidad`

The page presents three simulated upload cards:

1. `DNI — Frente`;
2. `DNI — Reverso`;
3. `Selfie / prueba de vida`.

1. Click each card once.
2. Wait for each card to change from `Cargando…` to `Cargado exitosamente`.
3. Click `Verificar identidad`.
4. Confirm the `Identidad verificada` toast.

Say:

> “This is the visual shape of the identity collection step. The current demo creates synthetic evidence statuses such as verified-demo and passed-demo; it does not process a real DNI image or liveness signal.”

#### Step 5: `Revisión del contrato`

1. Show the property, monthly rent, lease dates, file name, and the `12 páginas` placeholder preview.
2. Check `He revisado el contrato completo de arrendamiento`.
3. Click `Continuar`.

This is a useful place to ask the notary team whether a signer should be required to scroll through the complete document, whether a visible page count is sufficient, and what review evidence they would expect to see later.

#### Step 6: `Firma digital`

1. Point out the copy referring to the IOFE provider.
2. Click `Firmar documento`.
3. Wait for the short `Procesando firma…` state.
4. Confirm `Firma completada exitosamente`.
5. Click `Continuar`.

The screen describes a provider handoff, but the demo records a simulated signature after a short delay. Use this exact wording if asked:

> “The screen is modeling the intended provider handoff. In this environment it is mocked; there is no provider redirect or live certificate operation.”

#### Completed page

Show `Su firma ha sido registrada` and the explanation that access to the certified contract follows notary review.

This is the handoff point back to the packet lifecycle. The signer’s workspace status is now complete, and the realtor detail page can reflect signer progress after refresh.

### Part 5 — Return to the realtor and show the packet lifecycle

Navigate to `/agente/paquetes` and open the newest packet, or use the packet detail link from the wizard if it is still available.

Show the following in order:

1. packet code and current status;
2. status timeline;
3. signer progress and each signer’s evidence state;
4. initial and post-signature hash information when present;
5. payment section and placeholder method;
6. registry check;
7. audit trail and evidence report when present;
8. available actions in the right-side action card.

If only one signer was completed manually, click `Demo: avanzar firmantes` to advance the remaining signer(s) through the synthetic states. This is a presenter shortcut, not a production workflow. Tell the audience before clicking:

> “To keep the walkthrough focused on the notary review, I’m using a demo-only shortcut to complete the remaining synthetic signer state. In production, each signer would complete the actual flow independently.”

When all signers are complete:

1. click `Generar informe de evidencia`;
2. wait for `Informe de evidencia generado`;
3. click `Enviar a notario`;
4. wait for the packet to move to `Listo para notario`;
5. open the notary queue.

The regular lifecycle labels are:

```text
Borrador
Pendiente de pago
Listo para enviar
Enviado a firmantes
Parcialmente firmado
Firmantes completos
Informe generado
Listo para notario
En revisión notarial
Certificado
Certificado con observaciones
Requiere corrección
Rechazado
```

The `Enviar recordatorio` button may be shown while signers are pending. It displays `Recordatorio enviado` in the demo. It does not send or log an email/WhatsApp notification. Demonstrate it only if the audience understands that distinction.

### Part 6 — Show the party portals

Return to `/` and select `Arrendador` or `Arrendatario`.

The party dashboards show:

- `Mis contratos`;
- `Acciones pendientes`;
- `Contratos certificados`;
- `Renovación disponible` for eligible landlord records;
- a contract history table;
- account and post-certification information cards.

For a pending flow, `PKT-2024-001` is the most useful seeded record because it contains a landlord who is complete and a renter who is partway through identity. The party list is filtered against the current demo persona, so a newly created packet may not appear in every party list if its synthetic DNI does not match the seeded persona. Use the generated signer link for the full signer flow and use seeded records for the party-portal presentation.

On a party contract detail page, show:

- document name and upload timestamp;
- initial hash;
- monthly rent and lease dates;
- identity evidence count;
- signer name, DNI, and WhatsApp placeholder;
- signature validation state;
- landlord property-authority evidence when present;
- the simulated download button;
- renewal action when the landlord record is eligible.

For a certified-party view, a direct seeded detail route is more reliable than relying on the filtered dashboard list. Use:

```text
/arrendador/contratos/pkt-2024-004
/arrendatario/contratos/pkt-2024-004
```

These pages show the certified-document card and the simulated `Descargar contrato certificado` behavior. Say that the button currently demonstrates the access point and document state, not a real file delivery or authorization check.

### Part 7 — Show the registry surface

Open `/registro`.

1. Show the registry table and its columns:

   - property address;
   - landlords;
   - renters;
   - contract dates;
   - contract validity;
   - registry state;
   - packet code;
   - certification state.

2. In the search box, enter `Calle Las Flores`.
3. Point out the duplicate-address warning if it is displayed.
4. Explain that the seeded records include a current-looking active record and an older record at the same normalized address so the review surface can discuss duplicate detection.

Recommended wording:

> “This is a review signal, not an automatic legal conclusion. The notary needs to decide what the match means and what evidence or correction is required.”

The duplicate scenario is also visible from the notary packet detail for `PKT-2024-003`.

### Part 8 — Show the notary dashboard

Open `/notario`.

Point out:

- `Revisiones pendientes`;
- `Conteo mensual`;
- `Pago partner` as a demo estimate;
- `Documentos completados`;
- the queue tabs;
- the evidence-report status column;
- the registry-alert column;
- the packet code links.

The visible demo tabs are:

- `Pendientes de revisión` — packets in `Listo para notario`;
- `En revisión` — packets in `En revisión notarial`;
- `Certificados` — packets in `Certificado` or `Certificado con observaciones`;
- `Requieren corrección` — packets in `Requiere corrección`;
- `Rechazados` — packets in `Rechazado`.

The compatibility route `/notario/cola` redirects back to `/notario`; use the dashboard route in the meeting.

### Part 9 — Open the notary evidence review

For the full path, open the packet that you just submitted. For the backup path, open:

```text
/notario/paquetes/pkt-2024-002
```

That seeded packet is already in `Listo para notario` and includes completed signer evidence and a generated report.

On a packet in preview state:

1. Point out the `Vista previa — solo lectura` badge.
2. Explain that the checklist and decision panel are intentionally inactive until the notary starts the review.
3. Click `Iniciar revisión`.
4. Confirm the packet moves to `En revisión notarial`.

The evidence review is organized into these sections:

1. `Resumen del paquete`;
2. `Documento de arrendamiento`;
3. `Documento firmado final`;
4. `Evidencia por firmante`;
5. `Validación de firma digital`;
6. `Historial de hashes del documento`;
7. `Evidencia de propiedad`;
8. `Verificación de registro`;
9. `Registros de sesión y auditoría`;
10. `Banderas del sistema`;
11. `Lista de verificación del notario`;
12. `Panel de decisión` when enabled.

The numbered navigation on the left can be used to jump between sections on a desktop screen. On a narrow screen, scroll through the sections in order.

#### How to narrate each evidence section

Use the following review lens rather than claiming that the synthetic values are legally sufficient:

| Section | Presenter question |
|---|---|
| Package summary | Is the packet identity, version, property, term, and state clear? |
| Lease document | Can the reviewer identify the exact document and initial hash? |
| Signed document | Can the reviewer distinguish the original from the final signed artifact? |
| Signer evidence | Can the reviewer see each party’s progress independently? |
| Signature validation | Is provider, certificate, revocation, timestamp, and PDF integrity evidence visible? |
| Hash history | Can the reviewer follow document identity across stages? |
| Property evidence | Is authority evidence clearly labeled as a reference or verified source? |
| Registry check | Is a duplicate signal visible without silently deciding its legal meaning? |
| Audit trail | Can the reviewer reconstruct the session and sequence of actions? |
| System flags | Are warnings prominent and explainable? |
| Checklist | Can the notary record a review decision against defined items? |
| Decision panel | Can the notary approve evidence for the pending-seal stage, return for correction, or reject with a reason? |

### Part 10 — Complete the notary checklist

After `Iniciar revisión`, scroll to `Lista de verificación del notario`.

The demo checklist contains thirteen items:

1. `Revisé el documento de arrendamiento`;
2. `Revisé el PDF firmado final`;
3. `Revisé la evidencia de identidad de los firmantes`;
4. `Revisé los registros de verificación WhatsApp`;
5. `Revisé los registros de consentimiento`;
6. `Revisé la validación de firma IOFE`;
7. `Revisé la cadena de certificados`;
8. `Revisé la evidencia de timestamp`;
9. `Revisé el historial de hashes del documento`;
10. `Revisé los datos de la propiedad`;
11. `Revisé el resultado de verificación de registro de duplicados`;
12. `Revisé los registros de sesión y auditoría`;
13. `He determinado si la evidencia respalda la certeza indubitable de autenticidad`.

1. Click each checklist row once.
2. Watch the progress move from `0 de 13 completados` to `13 de 13 completados`.
3. Explain that the decision panel stays unavailable until all items are checked.

If the partner asks what happens when the checklist is incomplete, leave one item unchecked and scroll to the decision section. The UI should explain that all items must be completed before a decision is enabled.

### Part 11 — Demonstrate notary outcomes

After all checklist items are checked, the decision panel exposes four paths:

- `Aprobar evidencia para sello`;
- `Devolver para corrección`;
- `Rechazar`.

Do not execute multiple terminal decisions on the same packet unless you reset the demo workspace first. Choose the outcome that matches the discussion.

#### Option A: approval, certification, and publication

1. In `Evidencia de propiedad`, record a synthetic title number, owner names, result, and notes. Explain that this is a recorded demo check, not a live SUNARP lookup.
2. Complete the checklist, then click `Aprobar evidencia para sello` and confirm.
3. Return to the queue and open `Pendiente de sello`.
4. Open the packet’s certification page. Register document preparation, attestation, and report preparation in order.
5. Click `Publicar documento simulado`.
6. Open `Certificados`, then use the direct landlord and renter detail links on the certification page. The certified document record, final hash stage, and registry entry are synthetic workspace data. The role dashboards use seeded demo personas, so a newly certified packet may not appear in their filtered lists.

#### Option B: `Devolver para corrección`

1. Click `Devolver para corrección`.
2. Enter a reason, for example:

   ```text
   Adjuntar evidencia de propiedad actualizada y aclarar la alerta de duplicado.
   ```

3. Choose the correction scope if the dialog asks for it.
4. Confirm.
5. Show that the packet appears under `Requieren corrección`.

This is the preferred path for discussing how the notary communicates a remediable issue without rejecting the packet.

#### Option C: `Rechazar`

1. Click `Rechazar`.
2. Enter a synthetic reason.
3. Read the irreversible-action warning carefully.
4. Confirm only if the partner specifically wants to inspect the rejection path.
5. Show the `Rechazados` tab.

Never use real names or a real legal reason in a rejection demonstration. It is a synthetic outcome only.

## Fast path: notary review

Use this when time is limited or the notary team wants to focus on its own experience.

1. Start at `https://demo.veradoc.pe/notario`.
2. Click `Pendientes de revisión`.
3. Open `PKT-2024-002` or the first available packet.
4. Show the `Vista previa — solo lectura` state.
5. Click `Iniciar revisión`.
6. Show the summary, signed document, signer evidence, signature validation, hash history, registry check, and audit trail.
7. Complete the thirteen-item checklist.
8. Record the authority check and either approve evidence for the pending-seal stage or return the packet for correction.
9. Return to the queue and show the resulting tab.

This path demonstrates the notary component without pretending that the preceding signer, storage, payment, or notification integrations were live.

## Exception and discussion scenarios

### Duplicate-address scenario

Use `PKT-2024-003` or search `Calle Las Flores` in `/registro`.

Show:

- the warning icon in the notary queue;
- the `Verificación de registro` section;
- the matching packet reference and lease dates;
- the `Banderas del sistema` section if a duplicate flag is generated.

Ask:

- What should the notary see first?
- Is the warning strong enough without becoming an automatic rejection?
- Which source should be authoritative for the registry check?
- What is the expected correction or escalation path?

### Correction scenario

Use `PKT-2024-005`, which is seeded as `Requiere corrección`.

Open it from the `Requieren corrección` tab and show the recorded correction reason. Use it to discuss how the agent and parties would be notified in production. Be explicit that the demo does not actually send that notification.

### Certification-with-observations scenario

Use `PKT-2024-006`, which is seeded as `Certificado con observaciones`.

Show the observation, the certified document card, and the registry/property evidence. Ask whether the partner needs distinct operational queues, SLA timers, or report exports for qualified certifications.

### Preloaded certified scenario

Use `PKT-2024-004` for a clean certified record. It is useful for showing:

- a completed packet;
- the final certified document;
- the final hash stage;
- a completed notary checklist;
- post-certification party access;
- the simulated download control.

## Email, WhatsApp, and resend discussion guide

This topic is likely to arise because the product language includes links, WhatsApp verification, and reminders. Handle it explicitly.

### What can be shown now

- the agent can click `Enviar enlaces de firma`;
- the packet moves through the intended synthetic workspace lifecycle;
- the generated signer URLs can be copied;
- the signer screen models an OTP step;
- the packet detail can show `Enviar recordatorio`;
- success toasts make the intended UI feedback visible.

### What cannot be claimed

- that an email was sent to a production signer, or that sandbox delivery occurred without checking the demo result;
- that WhatsApp delivered an OTP;
- that a recipient opened the email;
- that a resend is rate-limited or idempotent;
- that a message can be retried after a provider failure;
- that a production delivery record exists;
- that a notification is tied to a durable production audit event.

### What must be completed before a provider-backed notification demo

Before telling the partner that resend email notifications work, the team needs at least:

1. a non-production email provider account or sandbox;
2. a verified sender domain and approved sender identity;
3. a delivery sink or test inbox that the team is authorized to use;
4. a durable notification record linked to packet, recipient, channel, and event;
5. explicit resend semantics, including rate limits and duplicate suppression;
6. provider failure, bounce, and timeout handling;
7. access controls so a resend cannot be used to disclose a packet to the wrong address;
8. redacted logs and a clear retention policy;
9. tests for first-send, resend, provider-failure, and already-completed signer cases;
10. a separate demo or staging configuration that cannot send to production recipients accidentally.

Until those conditions are met, use the sentence:

> “The notification control is represented in the demo, but provider delivery and resend behavior are not yet being exercised here.”

## Presenter language: safe claims and unsafe claims

Prefer:

- “The demo records a synthetic verification result.”
- “This screen models the intended signer handoff.”
- “The evidence package is organized around the questions the notary would review.”
- “This is a synthetic state transition in a temporary demo workspace.”
- “The notary decision is represented as a synthetic demo outcome.”
- “This warning is a review signal for the notary.”

Avoid:

- “The document was notarized.”
- “The email was delivered.”
- “The person passed identity verification.”
- “The signature is legally valid because this demo says so.”
- “The payment went through.”
- “The certificate came from IOFE.”
- “The registry was verified against SUNARP.”
- “Every partner device sees the same packet.”

The existing product positioning is that VeraDoc organizes remote evidence and workflow while the notary remains the certification authority. Preserve that distinction throughout the meeting.

## Troubleshooting during the walkthrough

### The packet list does not show a packet just created

1. Confirm that the packet was created with `Pagar y crear paquete`.
2. Confirm that `Enviar enlaces de firma` was clicked if the intended state is `Enviado a firmantes`.
3. Refresh the page.
4. Return to `/agente/paquetes` and open the newest entry.
5. If state is still confusing, use `Demo: avanzar firmantes` only after explaining the shortcut.

### The signer link says it is invalid

1. Confirm the link was copied from the current wizard or packet record.
2. Confirm that the entire `/firma/[token]` path was copied.
3. Do not alter the token or add spaces.
4. Confirm the signer link belongs to the active demo workspace.
5. If the packet was reset after the link was copied, generate a new link from the current state.

### The signer flow resumes at a later step

This is expected. The opening page reads the signer’s recorded workspace status and redirects to the appropriate next page. To demonstrate from the beginning, use `Reiniciar demo` and generate new links.

### The account step will not advance

The email is read-only. Use a synthetic password of at least eight characters and enter the same value in the confirmation field. Do not use a real password.

### The identity step will not advance

Click all three cards and wait for each `Cargando…` animation to complete. The `Verificar identidad` button remains disabled until all three cards show completion.

### The notary decision buttons are missing

1. Confirm that `Iniciar revisión` was clicked on a packet in `Listo para notario`.
2. Confirm the packet is in `En revisión notarial`.
3. Scroll to the checklist.
4. Check all thirteen items.
5. Return to the decision section.

### The partner cannot see the packet on a second laptop

Confirm that the partner opened the generated notary or signer access link for the same workspace. A fresh visit to the demo entry route can create a different workspace. Check that the workspace has not expired or been reset.

### The party dashboard does not show the newly created packet

The party portal filters seeded demo users by role and DNI. A newly created signer may not match the current seeded party persona. Use the generated signer link for the new packet, or open a seeded direct contract route for the party-portal presentation.

### The screen becomes difficult to read on a phone

Use the signer flow for the mobile-style portion. The wide realtor and notary tables are intended for desktop presentation. On a small screen, open the dashboard menu button before navigating.

### The browser shows stale or unexpected data

Refresh the page, then check the active workspace link and expiry. If needed, use `Reiniciar demo` and generate fresh access links. Do not troubleshoot by changing production data.

## Partner-facing question bank

### “Is this already connected to our notary operation?”

Answer:

> “The notary review experience is represented in the demo, including the evidence sections, checklist, and outcomes. The current host uses a temporary shared workspace with synthetic data. Connecting your operation would require the agreed roles, routing, evidence standards, legal controls, provider integrations, and an approved staging environment.”

### “Can our notary staff log in?”

Answer:

> “This demo does not use production account authentication. The production notary surface is a separate authenticated route and needs its own staging access and role setup.”

### “Can a signer use their phone?”

Answer:

> “The signer surface is designed as a clean, responsive flow and can be shown on a phone-sized viewport. This demo uses synthetic workspace state; it is not evidence of provider-backed identity, WhatsApp, or signing behavior.”

### “Can we resend a link if a signer misses it?”

Answer:

> “The demo has the reminder control and shows the intended UI feedback. It does not send a real reminder. Before relying on resend behavior, we need to complete provider delivery, durable event logging, idempotency, rate limits, and failure handling.”

### “Is the notary decision legally binding?”

Answer:

> “No conclusion should be drawn from the demo output. The decision controls illustrate the intended workflow. Legal effect, certification language, seal process, provider contracts, and operational authority must be approved before production use.”

### “Why is the registry warning not an automatic rejection?”

Answer:

> “The design treats it as a review signal. A match may require context and an operational decision. The partner team should define which conditions are blocking, which require clarification, and which are informational.”

### “Can we use a real contract in the demo?”

Answer:

> “No. The current demo uses synthetic document metadata and placeholder previews. Real documents should only be used in an approved environment with the agreed storage, retention, privacy, access, and deletion controls.”

## Definition of ready for this internal walkthrough

The meeting is ready to proceed when all of the following are true:

- [ ] The presenter can state the synthetic-demo limitation in the first two minutes.
- [ ] The partner understands that notification controls do not send real email or WhatsApp.
- [ ] The presenter has a clean browser profile or has reset the demo state deliberately.
- [ ] The presenter has tested the selected packet path immediately before the meeting.
- [ ] A fallback packet is known: `PKT-2024-002` for notary review, `PKT-2024-003` for duplicate detection, and `PKT-2024-006` for certification with observations.
- [ ] The presenter will use only fictional names, addresses, IDs, phone numbers, and emails.
- [ ] The presenter knows how `Reiniciar demo` affects the current access links.
- [ ] The presenter will use `demo.veradoc.pe`, not a production-facing role host.
- [ ] The presenter has allocated time for partner feedback rather than only clicking through happy-path screens.
- [ ] The presenter will record which evidence fields, exceptions, notifications, and role controls the notary team says are mandatory.

## Definition of ready for a real partner pilot

Do not call the product ready for a real partner pilot based only on this demo. A pilot gate should additionally cover:

1. separate staging and production configuration;
2. real authentication and role authorization;
3. durable database state;
4. host-scoped and cross-surface session behavior that has been tested;
5. controlled document storage and retrieval;
6. payment sandbox behavior and reconciliation;
7. approved identity and liveness provider behavior;
8. approved IOFE signing-provider behavior;
9. notification send, resend, failure, and audit behavior;
10. notary workflow authorization and decision auditability;
11. legal, privacy, consent, retention, and deletion review;
12. provider-backed acceptance tests with safe sinks;
13. security review for tokens, links, files, roles, and tenant boundaries;
14. operational support, incident handling, and recovery procedures;
15. a signed agreement with the notary partner defining the pilot scope.

The demo uses a temporary shared workspace with synthetic data. Keep that boundary clear during the walkthrough.

## After the meeting

Capture feedback in four buckets:

### Evidence requirements

- Which fields must always be present in the notary expediente?
- Which evidence needs a source link, provider receipt, timestamp, or certificate chain?
- What is the minimum review checklist?
- What must be visible before a decision can be made?

### Exceptions and decisions

- Which findings should return a packet for correction?
- Which findings should block certification?
- What observation language and scope controls are required?
- Is rejection irreversible, and what appeal or resubmission process is needed?

### Notifications and operations

- Which events require email, WhatsApp, SMS, or in-product notification?
- Who can resend, and how often?
- What should the notary see when a signer is stalled?
- What delivery evidence must be retained?

### Pilot controls

- Which real users may access the pilot?
- Which document types and jurisdictions are in scope?
- Which providers must be enabled?
- What data may be synthetic, masked, or real?
- What is the rollback and incident process?

## Final presenter checklist

Use this immediately before sharing your screen:

- [ ] Open `https://demo.veradoc.pe/`.
- [ ] Confirm the demo banner is visible.
- [ ] Confirm the browser contains no personal or production tabs.
- [ ] Confirm the chosen packet path and backup route.
- [ ] Confirm the fixed OTP is `123456`.
- [ ] Confirm the sample signer account values are fictional.
- [ ] Confirm the audience has heard that email, WhatsApp, payment, identity, signing, registry, and certification are simulated.
- [ ] Start with the workflow question, not with a claim of production readiness.
- [ ] Pause at the notary checklist and ask the partner to critique it.
- [ ] Demonstrate one decision outcome only unless a reset is performed.
- [ ] End by recording the partner’s required evidence, exception, and notification changes.

## Implementation references

The manual’s behavior notes are grounded in the current repository implementation:

- demo host and rollout constraints: [`SUBDOMAIN_TRANSITION_AGENT_GUIDE.md`](../SUBDOMAIN_TRANSITION_AGENT_GUIDE.md);
- demo route composition: [`app/demo/layout.tsx`](../app/demo/layout.tsx), [`app/demo/page.tsx`](../app/demo/page.tsx);
- shared demo workspace: [`components/demo/demo-workspace-provider.tsx`](../components/demo/demo-workspace-provider.tsx), [`lib/store/initial-data.ts`](../lib/store/initial-data.ts);
- packet creation wizard: [`app/demo/agente/nuevo-paquete/page.tsx`](../app/demo/agente/nuevo-paquete/page.tsx);
- packet lifecycle actions: [`lib/services/packet-service.ts`](../lib/services/packet-service.ts);
- signer flow: [`app/demo/firma/[token]`](../app/demo/firma/[token]);
- party portals: [`components/party/party-portal.tsx`](../components/party/party-portal.tsx);
- notary queue and evidence review: [`app/demo/notario/page.tsx`](../app/demo/notario/page.tsx), [`app/demo/notario/paquetes/[packetId]/page.tsx`](../app/demo/notario/paquetes/[packetId]/page.tsx);
- notary checklist and decisions: [`components/notary/checklist-panel.tsx`](../components/notary/checklist-panel.tsx), [`components/notary/decision-panel.tsx`](../components/notary/decision-panel.tsx), [`lib/services/notary-service.ts`](../lib/services/notary-service.ts);
- registry view: [`app/demo/registro/page.tsx`](../app/demo/registro/page.tsx);
- current browser acceptance limitations: [`docs/testing/subdomain-browser-acceptance-report.md`](testing/subdomain-browser-acceptance-report.md).
