import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { EvidenceReportData } from "./types";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#1a1a1a",
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: "#0f4c81",
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0f4c81",
  },
  subtitle: {
    fontSize: 10,
    color: "#666",
    marginTop: 4,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#0f4c81",
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    paddingBottom: 3,
  },
  row: {
    flexDirection: "row",
    marginBottom: 3,
  },
  label: {
    width: 140,
    fontWeight: "bold",
    fontSize: 8,
    color: "#444",
  },
  value: {
    flex: 1,
    fontSize: 8,
  },
  hashText: {
    fontFamily: "Courier",
    fontSize: 7,
  },
  badge: {
    fontSize: 7,
    paddingVertical: 1,
    paddingHorizontal: 4,
    borderRadius: 2,
    color: "#fff",
    alignSelf: "flex-start",
  },
  badgeGreen: { backgroundColor: "#16a34a" },
  badgeYellow: { backgroundColor: "#ca8a04" },
  badgeRed: { backgroundColor: "#dc2626" },
  badgeGray: { backgroundColor: "#6b7280" },
  table: {
    marginTop: 4,
    marginBottom: 6,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  tableCell: {
    fontSize: 7,
    flex: 1,
  },
  tableCellNarrow: {
    fontSize: 7,
    width: 80,
  },
  tableCellWide: {
    fontSize: 7,
    flex: 2,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 7,
    color: "#999",
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    paddingTop: 6,
  },
  summaryBox: {
    marginTop: 10,
    padding: 10,
    backgroundColor: "#f0f7ff",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#0f4c81",
  },
  summaryText: {
    fontSize: 9,
    lineHeight: 1.4,
  },
  flagItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  flagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#ca8a04",
    marginRight: 6,
  },
});

const STAGE_LABELS: Record<string, string> = {
  initial_upload: "Carga inicial",
  post_signatures: "Post-firmas",
  final_certified: "Certificado final",
};

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "verified" || status === "valid" || status === "accepted"
      ? styles.badgeGreen
      : status === "pending"
        ? styles.badgeYellow
        : status === "signed"
          ? styles.badgeGreen
          : styles.badgeGray;

  const label =
    status === "verified"
      ? "Verificado"
      : status === "valid"
        ? "Válido"
        : status === "accepted"
          ? "Aceptado"
          : status === "pending"
            ? "Pendiente"
            : status === "signed"
              ? "Firmado"
              : status;

  return <Text style={[styles.badge, variant]}>{label}</Text>;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "N/A";
  try {
    return new Date(iso).toLocaleString("es-PE", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function EvidenceReportDocument({
  data,
}: {
  data: EvidenceReportData;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            Informe de Evidencia Notarial
          </Text>
          <Text style={styles.subtitle}>
            VeraDoc &mdash; Paquete {data.packetCode} &mdash; Generado:{" "}
            {formatDate(data.generatedAt)}
          </Text>
          <Text style={[styles.subtitle, { marginTop: 2 }]}>
            Propiedad: {data.propertyAddress}
            {data.propertyUnit ? `, ${data.propertyUnit}` : ""}
            {data.district ? ` - ${data.district}` : ""}
            {data.province ? `, ${data.province}` : ""}
          </Text>
        </View>

        {/* Document Hash History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            1. Historial de Hashes del Documento
          </Text>
          {data.documentHashHistory.length === 0 ? (
            <Text style={styles.value}>Sin registros de hash.</Text>
          ) : (
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.tableCellNarrow}>Etapa</Text>
                <Text style={styles.tableCellWide}>Hash (SHA-256)</Text>
                <Text style={styles.tableCell}>Timestamp</Text>
              </View>
              {data.documentHashHistory.map((h, i) => (
                <View style={styles.tableRow} key={`hash-${i}`}>
                  <Text style={styles.tableCellNarrow}>
                    {STAGE_LABELS[h.stage] ?? h.stage}
                  </Text>
                  <Text style={[styles.tableCellWide, styles.hashText]}>
                    {h.hash}
                  </Text>
                  <Text style={styles.tableCell}>
                    {formatDate(h.timestamp)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Signer Evidence Summaries */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            2. Resumen de Evidencia por Firmante
          </Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableCell}>Firmante</Text>
              <Text style={styles.tableCellNarrow}>DNI</Text>
              <Text style={styles.tableCellNarrow}>Rol</Text>
              <Text style={styles.tableCellNarrow}>Identidad</Text>
              <Text style={styles.tableCellNarrow}>Firma</Text>
              <Text style={styles.tableCellNarrow}>Consentimiento</Text>
            </View>
            {data.signerEvidenceSummaries.map((s, i) => (
              <View style={styles.tableRow} key={`signer-${i}`}>
                <Text style={styles.tableCell}>{s.signerName}</Text>
                <Text style={styles.tableCellNarrow}>{s.signerDni}</Text>
                <Text style={styles.tableCellNarrow}>{s.roleInLease}</Text>
                <Text style={styles.tableCellNarrow}>
                  {s.identityStatus === "verified" ? "Verificado" : "Pendiente"}
                </Text>
                <Text style={styles.tableCellNarrow}>
                  {s.signatureStatus === "valid" || s.signatureStatus === "signed"
                    ? "Válida"
                    : "Pendiente"}
                </Text>
                <Text style={styles.tableCellNarrow}>
                  {s.consentStatus === "accepted" ? "Aceptado" : "Pendiente"}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* OTP Verification Records */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            3. Registros de Verificación WhatsApp (OTP)
          </Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableCell}>Firmante</Text>
              <Text style={styles.tableCellNarrow}>Canal</Text>
              <Text style={styles.tableCell}>Enviado</Text>
              <Text style={styles.tableCell}>Verificado</Text>
            </View>
            {data.otpRecords.map((r, i) => (
              <View style={styles.tableRow} key={`otp-${i}`}>
                <Text style={styles.tableCell}>{r.signerName}</Text>
                <Text style={styles.tableCellNarrow}>{r.channel}</Text>
                <Text style={styles.tableCell}>{formatDate(r.sentAt)}</Text>
                <Text style={styles.tableCell}>
                  {r.verifiedAt ? formatDate(r.verifiedAt) : "Pendiente"}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Consent Records */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            4. Registros de Consentimiento
          </Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableCell}>Firmante</Text>
              <Text style={styles.tableCell}>Tipo</Text>
              <Text style={styles.tableCell}>Fecha</Text>
              <Text style={styles.tableCellNarrow}>IP</Text>
            </View>
            {data.consentRecords.map((c, i) => (
              <View style={styles.tableRow} key={`consent-${i}`}>
                <Text style={styles.tableCell}>{c.signerName}</Text>
                <Text style={styles.tableCell}>{c.consentType}</Text>
                <Text style={styles.tableCell}>
                  {formatDate(c.acceptedAt)}
                </Text>
                <Text style={styles.tableCellNarrow}>{c.ip}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Signature Validation Results */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            5. Validación de Firmas Digitales
          </Text>
          {data.signatureValidationResults.length === 0 ? (
            <Text style={styles.value}>
              Sin registros de validación de firma.
            </Text>
          ) : (
            data.signatureValidationResults.map((sv, i) => (
              <View key={`sig-${i}`} style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 8, fontWeight: "bold", marginBottom: 3 }}>
                  {sv.signerName}
                </Text>
                <View style={styles.row}>
                  <Text style={styles.label}>Sujeto del certificado:</Text>
                  <Text style={styles.value}>
                    {sv.certificateSubject ?? "N/A"}
                  </Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Emisor:</Text>
                  <Text style={styles.value}>
                    {sv.certificateIssuer ?? "N/A"}
                  </Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Cadena de certificados:</Text>
                  <StatusBadge
                    status={sv.chainValidationResult ?? "pending"}
                  />
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Estado de revocación:</Text>
                  <StatusBadge
                    status={sv.revocationResult ?? "pending"}
                  />
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Timestamp:</Text>
                  <StatusBadge
                    status={sv.timestampResult ?? "pending"}
                  />
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Integridad PDF:</Text>
                  <StatusBadge
                    status={
                      sv.pdfIntegrityValid === true
                        ? "valid"
                        : sv.pdfIntegrityValid === false
                          ? "invalid"
                          : "pending"
                    }
                  />
                </View>
                {sv.signedDocumentHash && (
                  <View style={styles.row}>
                    <Text style={styles.label}>Hash firmado:</Text>
                    <Text style={[styles.value, styles.hashText]}>
                      {sv.signedDocumentHash}
                    </Text>
                  </View>
                )}
              </View>
            ))
          )}
        </View>

        {/* Property Authority Evidence */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            6. Evidencia de Autoridad sobre la Propiedad
          </Text>
          <Text style={styles.value}>
            {data.propertyAuthorityEvidence}
          </Text>
        </View>

        {/* Duplicate Rental Check */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            7. Verificación de Duplicados en Registro
          </Text>
          <View style={styles.row}>
            <Text style={styles.label}>Verificado:</Text>
            <Text style={styles.value}>
              {data.duplicateRentalCheck.checked ? "Sí" : "No"}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Coincidencia encontrada:</Text>
            <StatusBadge
              status={
                data.duplicateRentalCheck.matchFound
                  ? "duplicate_warning"
                  : "valid"
              }
            />
          </View>
          {data.duplicateRentalCheck.details && (
            <View style={styles.row}>
              <Text style={styles.label}>Detalle:</Text>
              <Text style={styles.value}>
                {data.duplicateRentalCheck.details}
              </Text>
            </View>
          )}
        </View>

        {/* System Flags */}
        {data.systemFlags.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              8. Alertas del Sistema
            </Text>
            {data.systemFlags.map((flag, i) => (
              <View style={styles.flagItem} key={`flag-${i}`}>
                <View style={styles.flagDot} />
                <Text style={styles.value}>{flag}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Session Logs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {data.systemFlags.length > 0 ? "9" : "8"}. Registros de Sesión
          </Text>
          {data.sessionLogs.map((sl, i) => (
            <View key={`session-${i}`} style={{ marginBottom: 6 }}>
              <Text style={{ fontSize: 8, fontWeight: "bold", marginBottom: 2 }}>
                {sl.signerName}
              </Text>
              {sl.events.length === 0 ? (
                <Text style={styles.value}>Sin eventos registrados.</Text>
              ) : (
                sl.events.map((e, j) => (
                  <View style={styles.row} key={`evt-${i}-${j}`}>
                    <Text style={styles.tableCellNarrow}>
                      {formatDate(e.timestamp)}
                    </Text>
                    <Text style={styles.tableCell}>{e.type}</Text>
                  </View>
                ))
              )}
            </View>
          ))}
        </View>

        {/* Summary for Notary */}
        <View style={styles.summaryBox}>
          <Text style={{ fontSize: 10, fontWeight: "bold", marginBottom: 4 }}>
            Resumen para el Notario
          </Text>
          <Text style={styles.summaryText}>{data.summaryForNotary}</Text>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          VeraDoc &mdash; Plataforma de Certeza Documental &mdash; Este
          informe fue generado automáticamente. Paquete: {data.packetCode}
        </Text>
      </Page>
    </Document>
  );
}
