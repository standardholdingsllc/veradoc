/**
 * All Spanish UI strings for VeraDoc.pe.
 * Pure module — server-safe, no React, no store.
 * Components must import from here; never use inline Spanish strings.
 */

// ---------------------------------------------------------------------------
// Site metadata (SEO, Open Graph)
// ---------------------------------------------------------------------------
export const META = {
  siteName: "VeraDoc.pe",
  title:
    "VeraDoc.pe — Certificación de arrendamiento con revisión notarial",
  description:
    "Flujos de certificación de arrendamiento remoto para el sector inmobiliario peruano. Paquetes de evidencia notarial estructurados para revisión y certificación.",
  ogDescription:
    "Flujos de certificación de arrendamiento remoto para el sector inmobiliario peruano.",
} as const;

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------
export const NAV = {
  inicio: "Inicio",
  comoFunciona: "Cómo funciona",
  seguridad: "Seguridad",
  posicionamientoLegal: "Posicionamiento legal",
  precios: "Precios",
  contacto: "Contacto",
  verDemostracion: "Ver demostración",
  modoDemo: "Modo demostración — datos simulados",
  explorarDemostracion: "Explorar demostración",
  contactenos: "Contáctenos",
} as const;

// ---------------------------------------------------------------------------
// Page titles (routes)
// ---------------------------------------------------------------------------
export const PAGE_TITLES = {
  inicio: "Inicio",
  comoFunciona: "Cómo funciona",
  seguridad: "Seguridad y evidencia",
  posicionamientoLegal: "Posicionamiento legal",
  precios: "Precios",
  contacto: "Contacto",
  demo: "Explorar demostración",
  agenteDashboard: "Panel del agente inmobiliario",
  nuevoPaquete: "Crear paquete de arrendamiento",
  detallePaquete: "Detalle del paquete",
  firmaContrato: "Firma de contrato",
  verificacionWhatsapp: "Verificación WhatsApp",
  crearCuenta: "Crear cuenta",
  consentimiento: "Consentimiento",
  verificacionIdentidad: "Verificación de identidad",
  revisionContrato: "Revisión del contrato",
  firmaDigital: "Firma digital",
  firmaCompletada: "Firma completada",
  notarioDashboard: "Panel del notario",
  revisionEvidencia: "Revisión de evidencia",
  decisionCertificacion: "Decisión de certificación",
  arrendadorDashboard: "Panel del arrendador",
  arrendatarioDashboard: "Panel del arrendatario",
  registro: "Registro de arrendamientos",
  administracion: "Administración interna",
} as const;

// ---------------------------------------------------------------------------
// Role labels (user-facing)
// ---------------------------------------------------------------------------
export const ROLES = {
  realtor: "Agente inmobiliario",
  landlord: "Arrendador",
  renter: "Arrendatario",
  notary: "Notario",
} as const;

export const ROLE_DESCRIPTIONS = {
  realtor: "Crea paquetes de arrendamiento y gestiona firmantes",
  landlord: "Verifica identidad y firma el contrato de arrendamiento",
  renter: "Verifica identidad y firma el contrato de arrendamiento",
  notary: "Revisa el expediente de evidencia y certifica el contrato",
} as const;

export const ROLE_CARD_DESCRIPTIONS = {
  realtor: "Cree paquetes, envíe a firmantes, envíe a notario",
  landlord: "Verifique identidad, firme contrato, acceda al certificado",
  renter: "Verifique identidad, firme contrato, acceda al certificado",
  notary: "Revise evidencia, tome decisión de certificación",
} as const;

// ---------------------------------------------------------------------------
// Sidebar navigation (demo dashboards)
// ---------------------------------------------------------------------------
export const SIDEBAR = {
  panel: "Panel",
  paquetes: "Paquetes",
  nuevoPaquete: "Nuevo paquete",
  registro: "Registro",
  colaNotarial: "Cola notarial",
  contratos: "Contratos",
  configuracion: "Configuración",
} as const;

// ---------------------------------------------------------------------------
// Packet actions
// ---------------------------------------------------------------------------
export const ACTIONS = {
  crearPaquete: "Crear nuevo paquete de arrendamiento",
  pagarYCrear: "Pagar y crear paquete",
  enviarEnlaces: "Enviar enlaces de firma",
  generarInforme: "Generar informe de evidencia",
  enviarANotario: "Enviar a notario",
  iniciarRevision: "Iniciar revisión",
  tomarDecision: "Tomar decisión",
  certificar: "Certificar",
  certificarConObservaciones: "Certificar con observaciones",
  devolverParaCorreccion: "Devolver para corrección",
  rechazar: "Rechazar",
  enviarRecordatorio: "Enviar recordatorio",
  descargarContrato: "Descargar contrato certificado",
  comenzarVerificacion: "Comenzar verificación",
  verEnlaces: "Ver enlaces",
  reenviarAFirmantes: "Re-enviar a firmantes",
  reenviarANotario: "Reenviar a notario",
  continuarConFirma: "Continuar con proveedor de firma digital",
  firmarConProveedor: "Firmar con proveedor",
  subirContrato: "Subir contrato",
  copiarEnlace: "Copiar enlace",
  copiarHashCompleto: "Copiar hash completo",
  iniciarRenovacion: "Iniciar renovación",
  completarRenovacion: "Completar renovación",
  volverAlPanel: "Volver al panel",
  seleccionarRol: "Seleccionar rol",
} as const;

// ---------------------------------------------------------------------------
// Signer flow step labels (8 steps)
// ---------------------------------------------------------------------------
export const SIGNER_STEPS = {
  inicio: "Inicio",
  verificar: "Verificación",
  crearCuenta: "Crear cuenta",
  consentimiento: "Consentimiento",
  identidad: "Identidad",
  revision: "Revisión",
  firmar: "Firma",
  completado: "Completado",
} as const;

// ---------------------------------------------------------------------------
// Signer flow copy
// ---------------------------------------------------------------------------
export const SIGNER = {
  mensajeApertura:
    "Está firmando un paquete de arrendamiento para {direccion}. Necesitamos confirmar su identidad, recoger su consentimiento, y guiarlo a través de la firma.",
  mensajeAperturaCorto:
    "Está firmando un paquete de arrendamiento para {direccion}",
  explicacionProceso:
    "VeraDoc lo guiará paso a paso para verificar su identidad, revisar el contrato y firmar de forma segura.",
  codigoWhatsapp: "Enviamos un código a su WhatsApp.",
  ingreseCodigo: "Ingrese el código de 6 dígitos",
  subirDniFrente: "Suba una foto del frente de su DNI.",
  subirDniReverso: "Suba una foto del reverso de su DNI.",
  subirSelfie: "Tome una selfie para verificación de identidad.",
  contratoRevisado: "He revisado el contrato completo",
  firmaRegistrada:
    "Su firma ha sido registrada. Recibirá acceso al contrato certificado una vez que el notario complete su revisión.",
  consentimientoTitulo: "Consentimiento informado",
  consentimientoTexto:
    "Autorizo el tratamiento de mis datos personales y la recopilación de evidencia digital con fines de verificación de identidad y firma del contrato de arrendamiento, conforme a la normativa aplicable.",
  aceptoConsentimiento: "Acepto los términos de consentimiento",
  cuentaCreada: "Cuenta creada exitosamente",
  identidadVerificada: "Identidad verificada",
  firmaCompletada: "Firma completada",
  pasoDe: "Paso {actual} de {total}",
} as const;

// ---------------------------------------------------------------------------
// Form labels
// ---------------------------------------------------------------------------
export const FORMS = {
  nombreCompleto: "Nombre completo",
  correoElectronico: "Correo electrónico",
  whatsapp: "WhatsApp",
  dni: "DNI",
  direccion: "Dirección del inmueble",
  unidad: "Unidad/Departamento",
  distrito: "Distrito",
  provincia: "Provincia",
  departamento: "Departamento",
  rentaMensual: "Renta mensual",
  deposito: "Depósito",
  moneda: "Moneda",
  fechaInicio: "Fecha de inicio",
  fechaVencimiento: "Fecha de vencimiento",
  duracion: "Duración (meses)",
  tipoUso: "Tipo de uso",
  vivienda: "Vivienda",
  comercial: "Comercial",
  notas: "Notas",
  contrasena: "Contraseña",
  confirmarContrasena: "Confirmar contraseña",
  rolEnContrato: "Rol en el contrato",
  agregarFirmante: "Agregar firmante",
  eliminarFirmante: "Eliminar firmante",
  codigoOtp: "Código de verificación",
  motivoRechazo: "Motivo de rechazo",
  motivoCorreccion: "Motivo de corrección",
  observacionesNotariales: "Observaciones notariales",
  buscar: "Buscar",
  filtrar: "Filtrar",
  ordenar: "Ordenar",
} as const;

// ---------------------------------------------------------------------------
// Wizard steps
// ---------------------------------------------------------------------------
export const WIZARD = {
  paso: "Paso",
  de: "de",
  cargarContrato: "Cargar contrato",
  datosContrato: "Datos del contrato",
  agregarFirmantes: "Agregar firmantes",
  revisarPaquete: "Revisar paquete",
  pago: "Pago",
  enviarEnlaces: "Enviar enlaces",
  documentoBloqueado:
    "Una vez creado, la versión del documento queda bloqueada.",
  tarifaVeradoc: "Tarifa VeraDoc",
  resumenPaquete: "Resumen del paquete",
  verificacionRegistro: "Verificación de registro",
  sinCoincidencias: "Sin coincidencias en el registro",
  coincidenciaEncontrada: "Coincidencia encontrada en el registro",
} as const;

// ---------------------------------------------------------------------------
// Notary checklist items
// ---------------------------------------------------------------------------
export const CHECKLIST = {
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
  revisarRegistro: "Revisé el resultado de verificación de registro de duplicados",
  revisarSesion: "Revisé los registros de sesión y auditoría",
  determinacion:
    "He determinado si la evidencia respalda la certeza indubitable de autenticidad",
} as const;

// ---------------------------------------------------------------------------
// Notary queue tabs
// ---------------------------------------------------------------------------
export const NOTARY_QUEUE = {
  pendientes: "Pendientes de revisión",
  enRevision: "En revisión",
  requierenCorreccion: "Requieren corrección",
  certificados: "Certificados",
  certificadosConObservaciones: "Certificados con observaciones",
  rechazados: "Rechazados",
} as const;

// ---------------------------------------------------------------------------
// Evidence section headers
// ---------------------------------------------------------------------------
export const EVIDENCE = {
  resumenPaquete: "Resumen del paquete",
  documentoArrendamiento: "Documento de arrendamiento",
  documentoFirmado: "Documento firmado final",
  evidenciaFirmante: "Evidencia por firmante",
  validacionFirma: "Validación de firma digital",
  historialHashes: "Historial de hashes del documento",
  evidenciaPropiedad: "Evidencia de propiedad",
  verificacionRegistro: "Verificación de registro",
  registrosSesion: "Registros de sesión y auditoría",
  banderasSistema: "Banderas del sistema",
  listaVerificacion: "Lista de verificación del notario",
  panelDecision: "Panel de decisión",
  informeEvidencia: "Informe de evidencia notarial",
  resumenParaNotario: "Resumen para el notario",
} as const;

// ---------------------------------------------------------------------------
// Evidence detail labels
// ---------------------------------------------------------------------------
export const EVIDENCE_DETAILS = {
  verificacionWhatsapp: "Verificación WhatsApp",
  canal: "Canal",
  codigoEnviado: "Código enviado",
  verificadoEn: "Verificado a las",
  consentimiento: "Consentimiento",
  tipo: "Tipo",
  aceptadoEn: "Aceptado a las",
  dispositivo: "Dispositivo",
  identidad: "Identidad",
  dniFrente: "DNI frente",
  dniReverso: "DNI reverso",
  selfieLiveness: "Selfie/liveness",
  resultadoRevision: "Resultado de revisión",
  firmaDigital: "Firma digital",
  proveedor: "Proveedor",
  sujetoCertificado: "Sujeto del certificado",
  emisorCertificado: "Emisor del certificado",
  numeroSerie: "Número de serie",
  periodoValidez: "Período de validez",
  cadenaCertificados: "Cadena de certificados",
  revocacion: "Revocación",
  timestamp: "Timestamp",
  integridadPdf: "Integridad del PDF",
  hashDocumentoFirmado: "Hash del documento firmado",
  hashCargaInicial: "Hash de carga inicial",
  hashPostFirma: "Hash post-firma",
  hashFinal: "Hash final",
  sunarpPlaceholder: "Registro SUNARP (referencia)",
  autoridadPropiedad: "Documento de autoridad de propiedad",
  verificacionDuplicados: "Verificación de duplicados",
  fuenteEvidencia: "Fuente de evidencia",
} as const;

// ---------------------------------------------------------------------------
// Status badge labels (link to constants.ts for full config)
// ---------------------------------------------------------------------------
export const STATUS_LABELS = {
  // packet
  draft: "Borrador",
  awaiting_payment: "Pendiente de pago",
  ready_to_send: "Listo para enviar",
  sent_to_signers: "Enviado a firmantes",
  partially_signed: "Parcialmente firmado",
  all_signers_complete: "Firmantes completos",
  evidence_report_generated: "Informe generado",
  ready_for_notary: "Listo para notario",
  under_notary_review: "En revisión notarial",
  certified: "Certificado",
  certified_with_observations: "Certificado con observaciones",
  needs_correction: "Requiere corrección",
  rejected: "Rechazado",
  archived: "Archivado",
  renewal_available: "Renovación disponible",
  renewal_in_progress: "Renovación en proceso",
  // signer
  link_sent: "Enlace enviado",
  link_opened: "Enlace abierto",
  otp_verified: "OTP verificado",
  account_created: "Cuenta creada",
  consent_accepted: "Consentimiento aceptado",
  identity_uploaded: "Identidad cargada",
  identity_verified_demo: "Identidad verificada",
  lease_reviewed: "Contrato revisado",
  signature_started: "Firma iniciada",
  signed: "Firmado",
  complete: "Completado",
} as const;

// ---------------------------------------------------------------------------
// Status next-action labels (packet lifecycle)
// ---------------------------------------------------------------------------
export const STATUS_NEXT_ACTIONS = {
  draft: "Complete el formulario",
  awaiting_payment: "Realizar pago",
  ready_to_send: "Enviar a firmantes",
  sent_to_signers: "Esperar firmas",
  partially_signed: "Esperar firmas restantes",
  all_signers_complete: "Generar expediente de evidencia",
  evidence_report_generated: "Enviar al notario",
  ready_for_notary: "Esperar revisión notarial",
  under_notary_review: "Completar revisión",
  certified: "Descargar contrato",
  certified_with_observations: "Descargar contrato",
  needs_correction: "Revisar observaciones",
  rejected: "Consultar motivo de rechazo",
  archived: "Sin acciones disponibles",
  renewal_available: "Iniciar renovación",
  renewal_in_progress: "Completar renovación",
} as const;

// ---------------------------------------------------------------------------
// Identity / signature validation status labels
// ---------------------------------------------------------------------------
export const VALIDATION_STATUS = {
  pending: "Pendiente",
  uploaded: "Cargado",
  verified_demo: "Verificado",
  completed: "Completado",
  passed_demo: "Aprobado",
  needs_review: "Requiere revisión",
  valid: "Válido",
  invalid: "Inválido",
  unknown: "Desconocido",
  good: "Vigente",
  revoked: "Revocado",
  missing: "Ausente",
  intact: "Íntegro",
  modified: "Modificado",
  sent: "Enviado",
  verified: "Verificado",
} as const;

// ---------------------------------------------------------------------------
// Document hash stages
// ---------------------------------------------------------------------------
export const HASH_STAGES = {
  initial_upload: "Carga inicial",
  post_signatures: "Post-firmas",
  final_certified: "Certificación final",
} as const;

// ---------------------------------------------------------------------------
// Correction scope labels
// ---------------------------------------------------------------------------
export const CORRECTION_SCOPE = {
  identity_recheck: "Re-verificación de identidad",
  contract_revision: "Revisión de contrato",
  document_metadata: "Corrección de metadatos",
  notary_observation: "Observación notarial",
} as const;

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------
export const REGISTRY = {
  titulo: "Registro de arrendamientos",
  buscarDireccion: "Buscar por dirección",
  vigente: "Vigente",
  vencido: "Vencido",
  activo: "Activo",
  inactivo: "Inactivo",
  vigenciaContrato: "Vigencia del contrato",
  estadoRegistral: "Estado registral",
  alertaDuplicado:
    "Alerta: Se detectó un arrendamiento activo registrado para esta propiedad",
  alertaDuplicadoMultiple:
    "Alerta: Se detectaron múltiples arrendamientos activos registrados para la misma propiedad",
  explicacion:
    "El registro proporciona alertas y banderas — no bloquea paquetes.",
  arrendadores: "Arrendador(es)",
  arrendatarios: "Arrendatario(s)",
  direccionPropiedad: "Dirección del inmueble",
  fechasContrato: "Fechas del contrato",
  estadoCertificacion: "Estado de certificación",
} as const;

// ---------------------------------------------------------------------------
// Dashboard summary cards
// ---------------------------------------------------------------------------
export const DASHBOARD = {
  paquetesActivos: "Paquetes activos",
  esperandoFirmantes: "Esperando firmantes",
  listosParaNotario: "Listos para notario",
  certificadosEsteMes: "Certificados este mes",
  requierenCorreccion: "Requieren corrección",
  contratosVigentes: "Contratos vigentes",
  misContratos: "Mis contratos",
  accionesPendientes: "Acciones pendientes de firma",
  renovacionDisponible: "Renovación disponible",
  codigoPaquete: "Código de paquete",
  ultimaActividad: "Última actividad",
  cantidadFirmantes: "Cantidad de firmantes",
  estadoInforme: "Estado del informe de evidencia",
  indicadorRegistro: "Indicador de registro",
  fechaEnvio: "Fecha de envío",
  estadoDecision: "Estado de decisión",
  agenteInmobiliario: "Agente inmobiliario",
} as const;

// ---------------------------------------------------------------------------
// Payment & invoice
// ---------------------------------------------------------------------------
export const PAYMENT = {
  titulo: "Pago",
  estado: "Estado del pago",
  monto: "Monto",
  metodo: "Método de pago",
  pagado: "Pagado",
  pendiente: "Pendiente",
  reembolsado: "Reembolsado",
  factura: "Factura",
  facturaPendiente: "Factura pendiente",
  facturaEmitida: "Factura emitida",
  descargarFactura: "Descargar factura",
  numeroFactura: "Número de factura",
} as const;

// ---------------------------------------------------------------------------
// Document & record attributes
// ---------------------------------------------------------------------------
export const DOCUMENT = {
  contrato: "Contrato",
  contratoArrendamiento: "Contrato de arrendamiento",
  contratoCertificado: "Contrato certificado",
  nombreArchivo: "Nombre del archivo",
  fechaCarga: "Fecha de carga",
  fechaGeneracion: "Fecha de generación",
  fechaCertificacion: "Fecha de certificación",
  hashInicial: "Hash inicial",
  hashActual: "Hash actual",
  vistaPrevia: "Vista previa del documento",
  enlaceFirma: "Enlace de firma",
  enlaceSeguro: "Enlace seguro de firma",
} as const;

export const RECORD = {
  codigo: "Código",
  version: "Versión",
  timestamp: "Marca de tiempo",
  actor: "Actor",
  estado: "Estado",
  hash: "Hash",
  fuenteEvidencia: "Fuente de evidencia",
  resultadoRevision: "Resultado de revisión",
  decision: "Decisión",
  observaciones: "Observaciones",
  auditoria: "Auditoría",
  lineaTiempo: "Línea de tiempo",
} as const;

// ---------------------------------------------------------------------------
// General UI
// ---------------------------------------------------------------------------
export const UI = {
  paquetes: "Paquetes",
  firmantes: "Firmantes",
  propiedad: "Propiedad",
  contrato: "Contrato",
  arrendamiento: "Arrendamiento",
  evidencia: "Evidencia",
  certificado: "Certificado",
  hash: "Hash",
  version: "Versión",
  codigo: "Código",
  fechaCreacion: "Fecha de creación",
  ultimaActividad: "Última actividad",
  proximaAccion: "Próxima acción",
  estado: "Estado",
  observaciones: "Observaciones",
  razon: "Razón",
  confirmar: "Confirmar",
  cancelar: "Cancelar",
  copiar: "Copiar",
  descargar: "Descargar",
  verMas: "Ver más",
  cerrar: "Cerrar",
  guardar: "Guardar",
  continuar: "Continuar",
  anterior: "Anterior",
  siguiente: "Siguiente",
  volver: "Volver",
  cargando: "Cargando…",
  sinResultados: "Sin resultados",
  verDetalle: "Ver detalle",
  expandir: "Expandir",
  contraer: "Contraer",
  seleccionar: "Seleccionar",
  todos: "Todos",
  si: "Sí",
  no: "No",
  opcional: "Opcional",
  requerido: "Requerido",
  acciones: "Acciones",
  detalles: "Detalles",
  resumen: "Resumen",
  enlaceCopiado: "Enlace copiado",
  hashCopiado: "Hash copiado",
} as const;

// ---------------------------------------------------------------------------
// Confirmation dialogs
// ---------------------------------------------------------------------------
export const CONFIRM = {
  certificarTitulo: "Confirmar certificación",
  certificarMensaje:
    "¿Confirma que desea certificar este paquete de arrendamiento?",
  certificarConObservacionesTitulo: "Confirmar certificación con observaciones",
  certificarConObservacionesMensaje:
    "¿Confirma la certificación con las observaciones indicadas?",
  devolverTitulo: "Devolver para corrección",
  devolverMensaje:
    "¿Confirma que desea devolver este paquete para corrección?",
  rechazarTitulo: "Rechazar paquete",
  rechazarMensaje: "¿Confirma que desea rechazar este paquete? Esta acción es irreversible.",
  iniciarRevisionTitulo: "Iniciar revisión notarial",
  iniciarRevisionMensaje:
    "Al iniciar la revisión, el paquete quedará en estado de revisión activa.",
} as const;

// ---------------------------------------------------------------------------
// Toast / notification messages
// ---------------------------------------------------------------------------
export const TOAST = {
  pagoConfirmado: "Pago confirmado",
  enlacesEnviados: "Enlaces de firma enviados",
  informeGenerado: "Informe de evidencia generado",
  paqueteCertificado: "Paquete certificado exitosamente",
  paqueteCertificadoConObservaciones:
    "Paquete certificado con observaciones",
  devueltoCorreccion: "Paquete devuelto para corrección",
  paqueteRechazado: "Paquete rechazado",
  firmaRegistrada: "Su firma ha sido registrada",
  consentimientoAceptado: "Consentimiento registrado",
  identidadVerificada: "Identidad verificada",
  otpVerificado: "Verificación exitosa",
  revisionIniciada: "Revisión notarial iniciada",
  recordatorioEnviado: "Recordatorio enviado",
  paqueteEnviadoNotario: "Paquete enviado al notario",
  reenviadoFirmantes: "Paquete reenviado a firmantes",
  reenviadoNotario: "Paquete reenviado al notario",
  errorGenerico: "Ocurrió un error. Intente nuevamente.",
  copiadoPortapapeles: "Copiado al portapapeles",
} as const;

// ---------------------------------------------------------------------------
// Form validation / error messages
// ---------------------------------------------------------------------------
export const ERRORS = {
  campoRequerido: "Este campo es requerido",
  correoInvalido: "Ingrese un correo electrónico válido",
  dniInvalido: "Ingrese un DNI válido (8 dígitos)",
  whatsappInvalido: "Ingrese un número de WhatsApp válido",
  contrasenasNoCoinciden: "Las contraseñas no coinciden",
  contrasenaMinima: "La contraseña debe tener al menos 8 caracteres",
  otpInvalido: "Código de verificación inválido",
  consentimientoRequerido: "Debe aceptar el consentimiento para continuar",
  contratoNoRevisado: "Debe confirmar que revisó el contrato completo",
  checklistIncompleto:
    "Complete todos los elementos de la lista de verificación",
  observacionesRequeridas: "Las observaciones son requeridas",
  motivoRequerido: "El motivo es requerido",
  firmanteRequerido: "Debe agregar al menos un firmante",
  documentoRequerido: "Debe cargar el documento de arrendamiento",
  montoInvalido: "Ingrese un monto válido",
  fechaInvalida: "Ingrese una fecha válida",
  paqueteNoEncontrado: "Paquete no encontrado",
  firmanteNoEncontrado: "Firmante no encontrado",
  enlaceInvalido: "Enlace de firma inválido o expirado",
} as const;

// ---------------------------------------------------------------------------
// Homepage copy
// ---------------------------------------------------------------------------
export const HOMEPAGE = {
  heroTitle:
    "Flujos de certificación de arrendamiento remoto para el sector inmobiliario peruano",
  heroSubtitle:
    "VeraDoc ayuda a profesionales inmobiliarios a crear paquetes estructurados de arrendamiento, recopilar evidencia de firmantes, validar firmas digitales, y presentar un expediente completo de revisión a un notario participante.",
  ctaDemo: "Ver demostración",
  ctaComoFunciona: "Cómo funciona",
  posicionamiento:
    "VeraDoc organiza la evidencia y el flujo de trabajo. El notario participante mantiene la responsabilidad de revisar el expediente y decidir si la certificación es apropiada.",
  ctaFinal: "Contáctenos",
} as const;

export const HOMEPAGE_TRUST = {
  paraAgentes: "Para agentes inmobiliarios",
  paraArrendadores: "Para arrendadores",
  paraArrendatarios: "Para arrendatarios",
  paraNotarios: "Para notarios",
  agentesDesc:
    "Cree paquetes estructurados y gestione firmantes de principio a fin",
  arrendadoresDesc:
    "Verifique su identidad y firme con evidencia documentada",
  arrendatariosDesc:
    "Complete su firma de forma segura desde cualquier dispositivo",
  notariosDesc:
    "Revise expedientes completos con evidencia estructurada",
} as const;

export const HOMEPAGE_PROBLEM = {
  titulo: "El problema",
  fragmentacion:
    "Fragmentación de firmas y documentos dispersos entre múltiples canales",
  identidad:
    "Evidencia de identidad dispersa sin trazabilidad unificada",
  confianza:
    "Problemas de confianza notarial con procesos de firma remota",
  duplicados: "Riesgo de arrendamiento duplicado sin alertas centralizadas",
  recuperacion:
    "Dificultad de recuperación y acceso a documentos certificados",
} as const;

export const HOMEPAGE_SOLUTION = {
  titulo: "La solución",
  paqueteControlado: "Paquete de arrendamiento controlado",
  verificacionFirmantes: "Verificación documentada de firmantes",
  evidenciaFirma: "Evidencia de firma digital validada",
  informeNotarial: "Informe de evidencia notarial estructurado",
  panelNotarial: "Panel de revisión notarial basado en evidencia",
  almacenamiento:
    "Almacenamiento certificado y registro de arrendamientos",
} as const;

export const HOMEPAGE_WORKFLOW = {
  titulo: "Flujo de trabajo",
  crear: "Crear",
  verificar: "Verificar",
  firmar: "Firmar",
  evidencia: "Evidencia",
  enviar: "Enviar",
  certificar: "Certificar",
  registrar: "Registrar",
} as const;

export const HOMEPAGE_EVIDENCE = {
  titulo: "Paquete de evidencia",
  identidad: "Evidencia de identidad",
  consentimiento: "Registros de consentimiento",
  otp: "Verificación WhatsApp",
  firma: "Validación de firma digital",
  hashes: "Cadena de hashes del documento",
  auditoria: "Registros de sesión y auditoría",
  registro: "Verificación de registro",
} as const;

// ---------------------------------------------------------------------------
// Marketing pages — Cómo funciona
// ---------------------------------------------------------------------------
export const COMO_FUNCIONA = {
  titulo: "Cómo funciona",
  subtitulo:
    "Un flujo estructurado de principio a fin para la certificación de arrendamientos",
  quienActua: "Quién actúa",
  queSucede: "Qué sucede",
  evidenciaCreada: "Evidencia creada",
  siguientePaso: "Siguiente paso",
} as const;

// ---------------------------------------------------------------------------
// Marketing pages — Seguridad
// ---------------------------------------------------------------------------
export const SEGURIDAD = {
  titulo: "Seguridad y evidencia",
  subtitulo:
    "Controles de integridad y trazabilidad para cada etapa del proceso",
  versionesDocumento: "Control de versiones del documento",
  cadenaHashes: "Cadena de hashes del documento",
  validacionCertificados: "Validación de certificados digitales",
  registroAuditoria: "Registro de auditoría inmutable",
  capturaConsentimiento: "Captura de consentimiento documentada",
  registroSesion: "Registro de sesión y dispositivo",
  avisoDemo:
    "En la demostración, estos controles están simulados con datos de ejemplo.",
} as const;

// ---------------------------------------------------------------------------
// Marketing pages — Posicionamiento legal
// ---------------------------------------------------------------------------
export const LEGAL = {
  titulo: "Posicionamiento legal",
  plataformaEvidencia:
    "VeraDoc es una plataforma de organización de evidencia y flujo de trabajo",
  apoyaRecopilacion:
    "Apoya la recopilación remota de evidencia y la revisión notarial",
  notarioAutoridad:
    "El notario permanece como la autoridad certificadora",
  produccionRequiere:
    "El lanzamiento en producción requiere revisión legal, acuerdos notariales, contratos con proveedores de firma, política de privacidad, términos de procesamiento de datos y controles operacionales",
  disclaimer:
    "Esta demostración no constituye asesoría legal ni certificación notarial real.",
} as const;

// ---------------------------------------------------------------------------
// Marketing pages — Precios & Contacto (placeholders)
// ---------------------------------------------------------------------------
export const PRECIOS = {
  titulo: "Precios",
  subtitulo: "Información de precios disponible próximamente",
  contactarVentas: "Contáctenos para más información",
} as const;

export const CONTACTO = {
  titulo: "Contacto",
  subtitulo: "Estamos disponibles para responder sus consultas",
  nombre: "Nombre",
  mensaje: "Mensaje",
  enviar: "Enviar mensaje",
  placeholder: "Formulario de contacto disponible próximamente",
} as const;

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------
export const FOOTER = {
  derechos: "Todos los derechos reservados",
  avisoLegal: "Aviso legal",
  privacidad: "Política de privacidad",
  terminos: "Términos de uso",
  descripcion:
    "Plataforma de certificación de arrendamiento con revisión notarial para el sector inmobiliario peruano.",
} as const;

// ---------------------------------------------------------------------------
// Terminology (preferred product phrases)
// ---------------------------------------------------------------------------
export const TERMINOLOGY = {
  paqueteEvidencia: "Paquete de evidencia notarial estructurado",
  flujoCertificacion:
    "Flujo de certificación de arrendamiento con revisión notarial",
  paqueteControlado: "Paquete de arrendamiento controlado",
  verificacionDocumentada: "Verificación documentada de firmantes",
  revisionBasadaEvidencia: "Revisión notarial basada en evidencia",
  alertaDuplicado: "Alerta de arrendamiento activo duplicado",
  accesoPostCertificacion: "Acceso post-certificación al documento",
  certezaIndubitable: "Certeza indubitable de autenticidad",
  paqueteArrendamiento: "Paquete de arrendamiento",
  informeEvidenciaNotarial: "Informe de evidencia notarial",
} as const;

// ---------------------------------------------------------------------------
// Empty states
// ---------------------------------------------------------------------------
export const EMPTY = {
  sinPaquetes: "No hay paquetes para mostrar",
  sinFirmantes: "No hay firmantes registrados",
  sinEventos: "No hay eventos de auditoría",
  sinResultadosBusqueda: "No se encontraron resultados para su búsqueda",
  colaVacia: "No hay paquetes en esta cola",
} as const;
