import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { CertifiedDocumentData } from "./types";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#1a1a1a",
  },
  header: {
    marginBottom: 16,
    borderBottomWidth: 3,
    borderBottomColor: "#0f4c81",
    paddingBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#0f4c81",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 10,
    color: "#666",
    marginTop: 4,
    textAlign: "center",
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
  certBlock: {
    padding: 14,
    backgroundColor: "#f0f7ff",
    borderWidth: 1,
    borderColor: "#0f4c81",
    borderRadius: 4,
    marginBottom: 14,
  },
  certText: {
    fontSize: 10,
    lineHeight: 1.6,
    textAlign: "justify",
  },
  row: {
    flexDirection: "row",
    marginBottom: 3,
  },
  label: {
    width: 160,
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
  checklistItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 3,
  },
  checkmark: {
    width: 12,
    height: 12,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "#16a34a",
    backgroundColor: "#dcfce7",
    marginRight: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  checkmarkText: {
    fontSize: 7,
    color: "#16a34a",
    fontWeight: "bold",
  },
  uncheckmark: {
    width: 12,
    height: 12,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "#d1d5db",
    marginRight: 6,
  },
  checklistLabel: {
    fontSize: 8,
    flex: 1,
  },
  observationsBox: {
    padding: 10,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#f59e0b",
    borderRadius: 4,
    marginTop: 8,
  },
  observationsLabel: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#b45309",
    marginBottom: 4,
  },
  observationsText: {
    fontSize: 9,
    lineHeight: 1.4,
  },
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
    width: 90,
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
  signatureArea: {
    marginTop: 30,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#ccc",
    alignItems: "center",
  },
  signatureLine: {
    width: 200,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    marginBottom: 4,
    marginTop: 40,
  },
  signatureLabel: {
    fontSize: 8,
    color: "#666",
    textAlign: "center",
  },
});

const STAGE_LABELS: Record<string, string> = {
  initial_upload: "Carga inicial",
  post_signatures: "Post-firmas",
  final_certified: "Certificado final",
};

const CHECKLIST_LABELS: Record<string, string> = {
  revisarDocumento: "Revisé el documento de arrendamiento",
  revisarPdfFirmado: "Revisé el PDF firmado final",
  revisarIdentidad: "Revisé la evidencia de identidad de los firmantes",
  revisarWhatsapp: "Revisé los registros de verificación WhatsApp",
  revisarConsentimiento: "Revisé los registros de consentimiento",
  revisarFirmaIofe: "Revisé la validación de firma IOFE",
  revisarCadena: "Revisé la cadena de certificados",
  revisarTimestamp: "Revisé la evidencia de timestamp",
  revisarHashes: "Revisé el historial de hashes del documento",
  revisarPropiedad: "Revisé los datos de la propiedad",
  revisarRegistro:
    "Revisé el resultado de verificación de registro de duplicados",
  revisarSesion: "Revisé los registros de sesión y auditoría",
  determinacion:
    "He determinado si la evidencia respalda la certeza indubitable de autenticidad",
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "N/A";
  try {
    return new Date(iso).toLocaleString("es-PE", {
      dateStyle: "long",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function CertifiedDocumentPdf({
  data,
}: {
  data: CertifiedDocumentData;
}) {
  const isCertifiedWithObs =
    data.certificationType === "certified_with_observations";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Documento Certificado</Text>
          <Text style={styles.subtitle}>
            VeraDoc &mdash; Plataforma de Certeza Documental
          </Text>
          <Text style={[styles.subtitle, { marginTop: 2 }]}>
            Paquete: {data.packetCode}
          </Text>
        </View>

        {/* Certification Text */}
        <View style={styles.certBlock}>
          <Text style={styles.certText}>
            {isCertifiedWithObs
              ? "CERTIFICO CON OBSERVACIONES: "
              : "CERTIFICO: "}
            Que el documento de arrendamiento correspondiente al paquete{" "}
            {data.packetCode}, ubicado en {data.propertyAddress}
            {data.propertyUnit ? `, ${data.propertyUnit}` : ""}
            {data.district ? ` - ${data.district}` : ""}
            {data.province ? `, ${data.province}` : ""}, ha sido revisado
            en su totalidad junto con toda la evidencia digital asociada.
            Las identidades de los firmantes han sido verificadas, las
            firmas digitales validadas, y la integridad documental
            confirmada mediante hashes criptográficos SHA-256.
          </Text>
        </View>

        {/* Property & Parties Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Datos del Contrato</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Propiedad:</Text>
            <Text style={styles.value}>
              {data.propertyAddress}
              {data.propertyUnit ? `, ${data.propertyUnit}` : ""}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Ubicación:</Text>
            <Text style={styles.value}>
              {data.district ?? ""}{data.province ? `, ${data.province}` : ""}
            </Text>
          </View>
          {data.leaseStartDate && data.leaseEndDate && (
            <View style={styles.row}>
              <Text style={styles.label}>Vigencia:</Text>
              <Text style={styles.value}>
                {formatDate(data.leaseStartDate)} al{" "}
                {formatDate(data.leaseEndDate)}
              </Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Arrendador(es):</Text>
            <Text style={styles.value}>
              {data.landlordNames.join(", ") || "N/A"}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Arrendatario(s):</Text>
            <Text style={styles.value}>
              {data.renterNames.join(", ") || "N/A"}
            </Text>
          </View>
        </View>

        {/* Notary Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Datos del Notario</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Notario:</Text>
            <Text style={styles.value}>{data.notaryName}</Text>
          </View>
          {data.accreditationNumber && (
            <View style={styles.row}>
              <Text style={styles.label}>N° de acreditación:</Text>
              <Text style={styles.value}>{data.accreditationNumber}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Fecha de certificación:</Text>
            <Text style={styles.value}>{formatDate(data.certifiedAt)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Tipo:</Text>
            <Text style={styles.value}>
              {isCertifiedWithObs
                ? "Certificado con observaciones"
                : "Certificado"}
            </Text>
          </View>
        </View>

        {/* Checklist Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Lista de Verificación Notarial
          </Text>
          {Object.entries(data.checklistSummary).map(([key, checked]) => (
            <View style={styles.checklistItem} key={key}>
              {checked ? (
                <View style={styles.checkmark}>
                  <Text style={styles.checkmarkText}>✓</Text>
                </View>
              ) : (
                <View style={styles.uncheckmark} />
              )}
              <Text style={styles.checklistLabel}>
                {CHECKLIST_LABELS[key] ?? key}
              </Text>
            </View>
          ))}
        </View>

        {/* Observations */}
        {data.observations && (
          <View style={styles.observationsBox}>
            <Text style={styles.observationsLabel}>Observaciones:</Text>
            <Text style={styles.observationsText}>{data.observations}</Text>
          </View>
        )}

        {/* Document Hash History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Integridad Documental (Hashes SHA-256)
          </Text>
          {data.documentHashes.length === 0 ? (
            <Text style={styles.value}>Sin registros de hash.</Text>
          ) : (
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.tableCellNarrow}>Etapa</Text>
                <Text style={styles.tableCellWide}>Hash</Text>
                <Text style={styles.tableCell}>Timestamp</Text>
              </View>
              {data.documentHashes.map((h, i) => (
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

        {/* Signature Area */}
        <View style={styles.signatureArea}>
          <View style={styles.signatureLine} />
          <Text style={styles.signatureLabel}>{data.notaryName}</Text>
          <Text style={[styles.signatureLabel, { marginTop: 2 }]}>
            Notario Público
          </Text>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          VeraDoc &mdash; Plataforma de Certeza Documental &mdash; Documento
          certificado generado el {formatDate(data.certifiedAt)} &mdash;
          Paquete: {data.packetCode}
        </Text>
      </Page>
    </Document>
  );
}
